import * as Sentry from "@sentry/nextjs";
import { checkRateLimit } from "@vercel/firewall";

/**
 * One gate for every unauthenticated write path.
 *
 * outbound_clicks, subscribers and tool_submissions all accept anonymous
 * INSERT with WITH CHECK (true). A honeypot stops naive form-fillers and
 * nothing stops a script, so click counts, the subscriber list and the
 * moderation queue were all floodable.
 *
 * `unsubscribe` is the fourth and the only DESTRUCTIVE one. It is unauthenticated,
 * has no honeypot, and identifies its target by email alone, so by its own
 * documented limitation anyone can unsubscribe an address that is not theirs.
 * Ungated, that is a loop away from emptying the list.
 *
 * OPERATOR PREREQUISITE. `checkRateLimit` does not define a limit, it looks one
 * up: the id must exist as a rate-limit rule condition in the Vercel Firewall
 * dashboard. Until those rules are created this module rate-limits nothing at
 * all. The intended ceilings, per IP:
 *
 *   enki-outbound      60 / minute
 *   enki-newsletter     5 / hour
 *   enki-submit         5 / hour
 *   enki-unsubscribe    5 / hour
 *
 * FAILS OPEN, ALWAYS. A limiter that takes the newsletter down during its own
 * outage is worse than the abuse it prevents, and every path here is still
 * validated in the action and constrained in Postgres behind it. Three distinct
 * ways the check can fail to produce a verdict, all of which allow the write:
 *
 *   - `error: "not-found"`, meaning no rule with that id exists. The SDK
 *     answers `rateLimited: false`, byte-for-byte identical to a healthy check
 *     that passed, so nothing downstream can tell the difference.
 *   - `error: "blocked"`, a 403 on the SDK's own probe. This is a firewall
 *     MISCONFIGURATION, not a user exceeding a ceiling. The probe is stamped
 *     `user-agent: Bot/Vercel Rate Limit Checker`, so Attack Challenge Mode, a
 *     managed bot ruleset, or one over-broad deny rule makes every probe 403.
 *     Treating that as "over the limit" would reject every real signup and
 *     submission site-wide. On 2026-07-29 this site served 403 checkpoints on
 *     every URL for ~20 minutes (handoff.md D2), which under a fail-closed
 *     reading would have been a form outage on top of the 403s.
 *   - A thrown error: missing request context, no `x-real-ip` to key on, or an
 *     unexpected status. A protected preview deployment throws every time, as
 *     the probe hits the Vercel SSO wall and gets a 401.
 *
 * All three are reported, because each one is a silent failure by construction:
 * the limiter stops limiting and the site carries on looking healthy.
 *
 * The check is also inert outside production: the SDK short-circuits to "not
 * limited" whenever NODE_ENV !== "production" unless a development firewall
 * host is passed. Local testing cannot confirm the limits work.
 *
 * Scope. Callers gate on this AFTER their honeypot check, so honeypot-filled
 * requests never reach it. This caps writes, not function invocations; only a
 * real Firewall rule at the edge can do the latter.
 *
 * Deliberately no bot detection here. BotID was evaluated and rejected: it
 * reads a header its client SDK attaches by patching fetch/XHR, so it cannot
 * work on /go/[slug], which is a top-level document navigation. It would also
 * need site-wide POST protection to cover the footer newsletter form, and an
 * unchallenged request risks being classed as a bot, rejecting real signups.
 */
export type WritePath =
  | "outbound"
  | "newsletter"
  | "submit"
  | "unsubscribe";

/**
 * Explicit request context. The SDK otherwise reads an ambient
 * `globalThis[Symbol.for("@vercel/request-context")]` and throws when it is
 * absent, which is one of the ways the limiter dies silently. Every caller here
 * has the real request in hand, so it passes it.
 */
export type WriteContext = {
  request?: Request;
  headers?:
    | Headers
    | Record<string, string>
    | Record<string, string | string[]>;
};

/**
 * How long to wait for the firewall before treating the check as unavailable.
 *
 * The three failure modes documented above all assume the check RETURNS. There
 * is a fourth that does not: `checkRateLimit` issues a plain `fetch` with no
 * `AbortSignal` and no timeout, so a firewall that accepts the connection and
 * never answers produces a promise that never settles -- and a promise that
 * never settles is not something `catch` can reach. Without this race the
 * try/catch below buys fail-open for errors and fail-HANG for slowness, which
 * is a newsletter form that spins forever and an affiliate click that never
 * redirects: worse than the abuse the limiter exists to stop, and the exact
 * outcome "FAILS OPEN, ALWAYS" promises will not happen. Slow loss is a more
 * common shape of network-dependency outage than a clean rejection.
 *
 * The probe is a same-region self-fetch to /.well-known/vercel/rate-limit-api/
 * answering with a bare 204, so half a second is already generous.
 */
export const LIMITER_TIMEOUT_MS = 500;

/** Thrown only by `withTimeout`, so the report can name a hang as a hang. */
class RateLimitTimeout extends Error {
  constructor(ruleId: string) {
    super(`rate-limit check for "${ruleId}" exceeded ${LIMITER_TIMEOUT_MS}ms`);
    this.name = "RateLimitTimeout";
  }
}

async function withTimeout<T>(work: Promise<T>, ruleId: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  // Once the timeout wins the race below, nothing is awaiting `work` any more,
  // and a late rejection on it would surface as an unhandled rejection --
  // crashing a serverless invocation that has already served its response.
  // Marked handled now; the race still sees the original promise's own result.
  work.catch(() => {});

  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new RateLimitTimeout(ruleId)),
          LIMITER_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    // A pending timer would otherwise hold the invocation open past its response.
    clearTimeout(timer);
  }
}

/**
 * Sentry reports are deduped per failure kind per rule, for the lifetime of the
 * instance: enough to alert, not enough to burn the quota on a limiter that is
 * misconfigured on every single request. console.error is NOT deduped, so the
 * runtime logs keep the full picture.
 *
 * Reporting is explicit because console.error alone would NOT reach Sentry.
 * sentry.server.config.ts passes no `integrations`, so it gets the Node
 * defaults, whose `consoleIntegration` only attaches breadcrumbs to other
 * events and never creates one. `captureConsoleIntegration` does create events
 * but is not a default and is not enabled here, and enabling it globally would
 * also start capturing every other `[enki] ...` console.error in the codebase.
 */
const reported = new Set<string>();

function reportOnce(key: string, message: string, cause?: unknown): void {
  // A telemetry failure must never break the write path it is reporting on.
  // This runs inside allowWrite's own catch, so an unguarded throw here would
  // escape and reject a caller that was promised a boolean.
  try {
    if (cause === undefined) console.error(message);
    else console.error(message, cause);

    if (reported.has(key)) return;
    // Marked before sending, so a transport that throws on every call is not
    // retried on every request.
    reported.add(key);
    Sentry.captureMessage(message, "error");
  } catch {
    // Swallowed: there is nowhere left to report a failure of the reporter.
  }
}

export async function allowWrite(
  path: WritePath,
  context?: WriteContext,
): Promise<boolean> {
  const ruleId = `enki-${path}`;

  try {
    const { rateLimited, error } = await withTimeout(
      checkRateLimit(ruleId, context),
      ruleId,
    );

    if (error === "not-found") {
      reportOnce(
        `not-found:${ruleId}`,
        `[enki] rate-limit rule "${ruleId}" does not exist in the Vercel Firewall, so this path is NOT rate limited. Create the rule: the SDK answers "not limited" for a missing rule, which is indistinguishable from a passing check.`,
      );
      return true;
    }

    if (error === "blocked") {
      reportOnce(
        `blocked:${ruleId}`,
        `[enki] the rate-limit probe for "${ruleId}" was blocked by the firewall (403), so this path is NOT rate limited. This is firewall misconfiguration, not abuse: the probe is sent as "Bot/Vercel Rate Limit Checker", so Attack Challenge Mode, a managed bot ruleset, or a deny rule matching /.well-known/vercel/rate-limit-api/ will block it. That path must stay allowed. Treated as allowed so real users are not rejected.`,
      );
      return true;
    }

    return !rateLimited;
  } catch (cause) {
    // A hang and a throw are different faults needing different people: one is
    // a slow network path, the other a missing context or a 401 on the probe.
    // Reported under distinct keys so the dedup Set cannot let the first one
    // seen silence the other for the life of the instance.
    if (cause instanceof RateLimitTimeout) {
      reportOnce(
        `timeout:${ruleId}`,
        `[enki] the rate-limit check for "${ruleId}" did not answer within ${LIMITER_TIMEOUT_MS}ms, so this path is NOT rate limited. The SDK fetches with no AbortSignal, so without a timeout this request would have hung rather than failed. Failing open.`,
        cause,
      );
      return true;
    }

    reportOnce(
      `threw:${ruleId}`,
      `[enki] the rate-limit check for "${ruleId}" threw, so this path is NOT rate limited. Common causes: no request context, no client IP to key on, or a protected deployment answering 401 to the probe. Failing open.`,
      cause,
    );
    return true;
  }
}
