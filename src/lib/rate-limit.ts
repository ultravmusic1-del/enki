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
 * all. A missing rule answers `{ rateLimited: false, error: "not-found" }`,
 * which is indistinguishable from a healthy check that passed, so the
 * `not-found` branch below is the only thing that will ever say so out loud.
 *
 * The check is also inert outside production: the SDK short-circuits to "not
 * limited" whenever NODE_ENV !== "production" unless a development firewall
 * host is passed. Local testing cannot confirm the limits work.
 *
 * Fails OPEN. A rate limiter that takes the newsletter down during its own
 * outage is worse than the abuse it prevents, and every one of these paths is
 * still validated in the action and constrained in Postgres behind it.
 *
 * Deliberately no bot detection here. BotID was evaluated and rejected for this
 * module: it reads a header its client SDK attaches by patching fetch/XHR, so
 * it cannot work on /go/[slug], which is a top-level document navigation. It
 * would also need site-wide POST protection to cover the footer newsletter
 * form, and an unchallenged request risks being classed as a bot, which would
 * reject legitimate signups. That is a separate, deliberate decision.
 */
export type WritePath = "outbound" | "newsletter" | "submit";

export async function allowWrite(path: WritePath): Promise<boolean> {
  const ruleId = `enki-${path}`;

  try {
    const { rateLimited, error } = await checkRateLimit(ruleId);

    // Sentry is wired across all three runtimes, so this console.error becomes a
    // visible production signal rather than a line nobody reads.
    if (error === "not-found") {
      console.error(
        `[enki] rate-limit rule "${ruleId}" does not exist in the Vercel Firewall, so this path is NOT rate limited. Create the rule: the SDK answers "not limited" for a missing rule, which is indistinguishable from a passing check.`,
      );
    }

    return !rateLimited;
  } catch {
    return true;
  }
}
