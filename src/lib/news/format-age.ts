/**
 * "12m ago" / "3h ago" / "3d ago".
 *
 * Call it on the server and pass the string down. Computing it inside a client
 * component renders one value on the server and another on hydration.
 */
export function formatAge(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const minutes = Math.floor(Math.max(0, now.getTime() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
