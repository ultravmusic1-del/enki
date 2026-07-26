/**
 * Supabase liveness. The free-tier project sleeps after inactivity; the public
 * site survives on the static seed but auth, reviews, saved tools, and the
 * whole admin need it awake. Knowing this up front beats discovering it
 * halfway through a task.
 *
 * The timeout matches the content layer's own budget in src/lib/content.ts.
 */

const DEFAULT_TIMEOUT_MS = 2500;

/**
 * @param {{
 *   url: string | null,
 *   key: string | null,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} input
 */
export async function probeSupabase({
  url,
  key,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!url || !key) {
    return { status: "skip", reason: "no-credentials" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${url}/rest/v1/`, {
      headers: { apikey: key },
      signal: controller.signal,
    });
    return response.ok
      ? { status: "awake", code: response.status }
      : { status: "unreachable", code: response.status };
  } catch {
    return { status: "asleep", reason: "timeout-or-network" };
  } finally {
    clearTimeout(timer);
  }
}
