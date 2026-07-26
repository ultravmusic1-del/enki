import { describe, it, expect } from "vitest";
import { parseEnvKeys, checkEnv } from "./env.mjs";

describe("parseEnvKeys", () => {
  it("returns the keys of assignment lines", () => {
    expect(parseEnvKeys("A=1\nB=two")).toEqual(["A", "B"]);
  });

  it("ignores comments, so commented keys read as optional", () => {
    expect(parseEnvKeys("# NEXT_PUBLIC_SITE_URL=x\nA=1")).toEqual(["A"]);
  });

  it("ignores blank lines and surrounding whitespace", () => {
    expect(parseEnvKeys("\n  A = 1  \n\n")).toEqual(["A"]);
  });
});

describe("checkEnv", () => {
  it("fails when the local file is absent and reports every required key", () => {
    const result = checkEnv({ exampleBody: "A=x\nB=y", localBody: null });
    expect(result.status).toBe("fail");
    expect(result.reason).toBe("no-file");
    expect(result.missing).toEqual(["A", "B"]);
  });

  it("names exactly the keys that are missing", () => {
    const result = checkEnv({ exampleBody: "A=x\nB=y", localBody: "A=real" });
    expect(result.status).toBe("fail");
    expect(result.reason).toBe("missing-keys");
    expect(result.missing).toEqual(["B"]);
  });

  it("passes when every required key is present", () => {
    const result = checkEnv({
      exampleBody: "A=x\nB=y",
      localBody: "B=real\nA=real",
    });
    expect(result.status).toBe("pass");
    expect(result.missing).toEqual([]);
  });

  it("does not require keys that are commented out in the example", () => {
    const result = checkEnv({
      exampleBody: "A=x\n# OPTIONAL=y",
      localBody: "A=real",
    });
    expect(result.status).toBe("pass");
  });
});
