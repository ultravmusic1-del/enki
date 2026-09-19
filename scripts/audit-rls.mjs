#!/usr/bin/env node
/**
 * `pnpm audit:rls` — prove Row Level Security still holds against the public key.
 *
 * The publishable key ships to every browser, so RLS is the only thing between
 * a stranger and the reviews queue, the subscriber list, the submission queue,
 * and the admin roster. A policy edit can reopen any of those silently; this
 * turns that into a command that fails.
 *
 * Reads .env.local directly rather than relying on a loader, so it behaves the
 * same whether run by hand, from CI, or from a hook.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  ANON_INVISIBLE_QUERIES,
  ANON_INVISIBLE_TABLES,
  ANON_REFUSED_RPCS,
  judge,
  judgeQuery,
  judgeRpc,
} from "./audit-rls/expectations.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l.slice(l.indexOf("=") + 1).trim(),
      ]),
  );
}

const env = { ...readEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "audit:rls needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (run `pnpm doctor`).",
  );
  process.exit(1);
}

const verdicts = [];
for (const table of ANON_INVISIBLE_TABLES) {
  let response = { status: 0, rows: null };
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, {
      headers: { apikey: key },
    });
    const rows = res.ok ? await res.json() : null;
    response = { status: res.status, rows: Array.isArray(rows) ? rows : null };
  } catch (error) {
    console.error(`  could not reach ${table}: ${error.message}`);
    process.exit(1);
  }
  verdicts.push(judge(table, response));
}

for (const query of ANON_INVISIBLE_QUERIES) {
  let response = { status: 0, rows: null };
  try {
    const res = await fetch(`${url}/rest/v1/${query.path}`, { headers: { apikey: key } });
    const rows = res.ok ? await res.json() : null;
    response = { status: res.status, rows: Array.isArray(rows) ? rows : null };
  } catch (error) {
    console.error(`  could not reach ${query.label}: ${error.message}`);
    process.exit(1);
  }
  verdicts.push(judgeQuery(query.label, response));
}

for (const rpc of ANON_REFUSED_RPCS) {
  let response = { status: 0, body: null };
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${rpc.fn}`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify(rpc.body),
    });
    response = { status: res.status, body: await res.json().catch(() => null) };
  } catch (error) {
    console.error(`  could not reach rpc ${rpc.fn}: ${error.message}`);
    process.exit(1);
  }
  verdicts.push(judgeRpc(rpc.fn, response));
}

console.log("\nRLS smoke test (anonymous, publishable key)\n");
for (const v of verdicts) {
  console.log(`  ${v.ok ? "PASS" : "FAIL"}  ${v.table.padEnd(28)} ${v.detail}`);
}

const failed = verdicts.filter((v) => !v.ok);
console.log(
  failed.length === 0
    ? "\nRLS holds.\n"
    : `\n${failed.length} check(s) failed.\n`,
);

process.exit(failed.length === 0 ? 0 : 1);
