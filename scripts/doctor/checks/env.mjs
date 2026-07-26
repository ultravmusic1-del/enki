/**
 * Environment check: .env.example is the contract, .env.local is the answer.
 *
 * .env.local is gitignored, so it never travels between machines. A fresh
 * clone or a second device starts without it and the app fails at runtime
 * rather than at setup. This check names the exact missing keys.
 */

/** Keys of the assignment lines in a dotenv body. Commented lines are optional. */
export function parseEnvKeys(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .filter((line) => line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter((key) => key.length > 0);
}

/**
 * @param {{exampleBody: string, localBody: string | null}} input
 *   localBody is null when .env.local does not exist.
 */
export function checkEnv({ exampleBody, localBody }) {
  const required = parseEnvKeys(exampleBody);

  if (localBody === null) {
    return { status: "fail", reason: "no-file", missing: required };
  }

  const present = new Set(parseEnvKeys(localBody));
  const missing = required.filter((key) => !present.has(key));

  return {
    status: missing.length > 0 ? "fail" : "pass",
    reason: missing.length > 0 ? "missing-keys" : null,
    missing,
  };
}
