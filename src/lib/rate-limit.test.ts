import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WritePath } from "@/lib/rate-limit";

const checkRateLimit = vi.fn();
vi.mock("@vercel/firewall", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}));

/**
 * The module dedupes Sentry reports in a module-level Set, so every test gets a
 * fresh instance. Without this the dedup state leaks between cases and the
 * report assertions below start depending on test order.
 */
let allowWrite: (typeof import("@/lib/rate-limit"))["allowWrite"];

beforeEach(async () => {
  vi.resetModules();
  checkRateLimit.mockReset();
  captureMessage.mockReset();
  ({ allowWrite } = await import("@/lib/rate-limit"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PATHS: WritePath[] = ["outbound", "newsletter", "submit"];

describe("allowWrite", () => {
  it("allows a caller within the limit", async () => {
    checkRateLimit.mockResolvedValue({ rateLimited: false });
    await expect(allowWrite("newsletter")).resolves.toBe(true);
  });

  it("blocks a caller over the limit", async () => {
    checkRateLimit.mockResolvedValue({ rateLimited: true });
    await expect(allowWrite("newsletter")).resolves.toBe(false);
  });

  // Asserting all three ids, not just one: a typo in a single rule id silently
  // disables that one path and every other test would still pass.
  it.each(PATHS)("looks up the enki-%s rule", async (path) => {
    checkRateLimit.mockResolvedValue({ rateLimited: false });
    await allowWrite(path);
    expect(checkRateLimit).toHaveBeenCalledWith(`enki-${path}`, undefined);
  });

  it("forwards the request context to the limiter", async () => {
    checkRateLimit.mockResolvedValue({ rateLimited: false });
    const context = { headers: new Headers({ "x-real-ip": "203.0.113.7" }) };

    await allowWrite("newsletter", context);

    expect(checkRateLimit).toHaveBeenCalledWith("enki-newsletter", context);
  });

  it("does not log when the rule exists and the caller is within the limit", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockResolvedValue({ rateLimited: false });

    await allowWrite("newsletter");

    expect(spy).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  // A missing Firewall rule returns `rateLimited: false`, byte-for-byte
  // identical to a healthy check that passed. Nothing else in the system can
  // tell the difference, so this report is the only thing that states the
  // consequence. Deleting it makes the outage silent.
  it("reports when no Firewall rule exists, and still fails open", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockResolvedValue({ rateLimited: false, error: "not-found" });

    await expect(allowWrite("outbound")).resolves.toBe(true);

    expect(spy).toHaveBeenCalledTimes(1);
    const message = String(spy.mock.calls[0]?.[0]);
    expect(message).toContain("enki-outbound");
    expect(message).toMatch(/not rate limited/i);
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  // The one that must never regress. A 403 on the SDK's probe means the
  // firewall is misconfigured, NOT that this user exceeded a ceiling. Returning
  // false here would reject every real signup and submission site-wide while
  // showing them a "too many attempts" message.
  it("fails OPEN when the probe is blocked, rather than rejecting real users", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockResolvedValue({ rateLimited: true, error: "blocked" });

    await expect(allowWrite("submit")).resolves.toBe(true);

    expect(spy).toHaveBeenCalledTimes(1);
    const message = String(spy.mock.calls[0]?.[0]);
    expect(message).toContain("enki-submit");
    expect(message).toMatch(/misconfiguration/i);
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it("reports and fails open when the limiter throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockRejectedValue(new Error("no request context"));

    await expect(allowWrite("outbound")).resolves.toBe(true);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain("enki-outbound");
    // The caught error is included so the log says which failure mode it was.
    expect(spy.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it("fails open on a malformed limiter response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    checkRateLimit.mockResolvedValue({});
    await expect(allowWrite("submit")).resolves.toBe(true);

    checkRateLimit.mockResolvedValue(undefined);
    await expect(allowWrite("submit")).resolves.toBe(true);
  });

  // Bounds the quota cost: a rule that is missing on every single request must
  // not send a Sentry event on every single request.
  it("reports a repeated failure to Sentry once, but logs every time", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockResolvedValue({ rateLimited: false, error: "not-found" });

    await allowWrite("newsletter");
    await allowWrite("newsletter");
    await allowWrite("newsletter");

    expect(spy).toHaveBeenCalledTimes(3);
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  // Pins the dedup key to `kind:ruleId` rather than bare `ruleId`. Under a bare
  // id the first report for a rule suppresses every later one, so a missing
  // rule would mask a blocked probe on the same path -- the more urgent of the
  // two, and the one that used to reject real users. This asserts 2; a
  // ruleId-only key makes it 1.
  it("reports both a missing rule and a blocked probe for the same id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    checkRateLimit.mockResolvedValue({ rateLimited: false, error: "not-found" });
    await expect(allowWrite("newsletter")).resolves.toBe(true);

    checkRateLimit.mockResolvedValue({ rateLimited: true, error: "blocked" });
    await expect(allowWrite("newsletter")).resolves.toBe(true);

    expect(captureMessage).toHaveBeenCalledTimes(2);
  });

  // "Fails open" has to mean "returns a boolean, always". reportOnce runs
  // inside allowWrite's own catch, so a throw from the reporter would escape
  // and reject a caller that neither server action wraps.
  it("still returns a verdict when the reporter itself throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    captureMessage.mockImplementation(() => {
      throw new Error("sentry transport down");
    });

    checkRateLimit.mockRejectedValue(new Error("no request context"));
    await expect(allowWrite("outbound")).resolves.toBe(true);

    checkRateLimit.mockResolvedValue({ rateLimited: false, error: "not-found" });
    await expect(allowWrite("newsletter")).resolves.toBe(true);
  });
});
