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

/**
 * An exact, unambiguous timestamp: "24 Sep 2026, 12:43 UTC". The site defines
 * no reader time zone, so trust signals state UTC rather than guess.
 */
export function formatExactTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
  // en-GB spells September "Sept" in current ICU; the site uses "Sep".
  return `${day.replace("Sept", "Sep")}, ${time} UTC`;
}

/** "Thu 24 Sep", the day a brief or issue covers (UTC). */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${weekday} ${day} ${month}`;
}
