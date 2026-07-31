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
 * OPERATOR PREREQUISITE. `checkRateLimit` does not define a limit, it looks one
 * up: the id must exist as a rate-limit rule condition in the Vercel Firewall
 * dashboard. Until those rules are created this module rate-limits nothing at
 * all. The intended ceilings, per IP:
 *
 *   enki-outbound    60 / minute
 *   enki-newsletter   5 / hour
 *   enki-submit       5 / hour
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
export type WritePath = "outbound" | "newsletter" | "submit";

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
    const { rateLimited, error } = await checkRateLimit(ruleId, context);

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
    reportOnce(
      `threw:${ruleId}`,
      `[enki] the rate-limit check for "${ruleId}" threw, so this path is NOT rate limited. Common causes: no request context, no client IP to key on, or a protected deployment answering 401 to the probe. Failing open.`,
      cause,
    );
    return true;
  }
}
