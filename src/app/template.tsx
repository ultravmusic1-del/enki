/**
 * Route template — re-mounts on every navigation, so the `.page-transition`
 * CSS animation (see globals.css) replays and each page fades + lifts into
 * view instead of hard-cutting. Kept a Server Component: it only wraps the
 * page in a styled element, no client JS needed.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
