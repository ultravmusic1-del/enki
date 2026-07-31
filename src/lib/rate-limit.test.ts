import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkRateLimit = vi.fn();
vi.mock("@vercel/firewall", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

const { allowWrite } = await import("@/lib/rate-limit");

beforeEach(() => {
  checkRateLimit.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("allowWrite", () => {
  it("allows a caller within the limit", async () => {
    checkRateLimit.mockResolvedValue({ rateLimited: false });
    await expect(allowWrite("newsletter")).resolves.toBe(true);
  });

  it("blocks a caller over the limit", async () => {
    checkRateLimit.mockResolvedValue({ rateLimited: true });
    await expect(allowWrite("newsletter")).resolves.toBe(false);
  });

  it("passes the path-specific rule id to the firewall", async () => {
    checkRateLimit.mockResolvedValue({ rateLimited: false });
    await allowWrite("submit");
    expect(checkRateLimit).toHaveBeenCalledWith("enki-submit");
  });

  it("fails open when the limiter itself errors", async () => {
    checkRateLimit.mockRejectedValue(new Error("network"));
    await expect(allowWrite("outbound")).resolves.toBe(true);
  });

  // A missing Firewall rule returns `rateLimited: false`, which is byte-for-byte
  // identical to a healthy check that passed. Nothing else in the system can
  // tell the difference, so this log is the ONLY signal that a write path is
  // unprotected. Deleting it makes the outage silent -- hence the assertion.
  it("logs an error naming the rule when no Firewall rule exists", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockResolvedValue({ rateLimited: false, error: "not-found" });

    await expect(allowWrite("outbound")).resolves.toBe(true);

    expect(spy).toHaveBeenCalledTimes(1);
    const message = String(spy.mock.calls[0]?.[0]);
    expect(message).toContain("enki-outbound");
    expect(message).toMatch(/not rate limited/i);
  });

  it("does not log when the rule exists and the caller is within the limit", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    checkRateLimit.mockResolvedValue({ rateLimited: false });

    await allowWrite("newsletter");

    expect(spy).not.toHaveBeenCalled();
  });
});
