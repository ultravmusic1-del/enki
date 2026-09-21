import Link from "next/link";
import type { Tool } from "@/lib/schemas";

/** "Tools in the news" (spec §7.2). The caller passes nothing when fewer than 3 qualify. */
export function TickerStrip({ items }: { items: { tool: Tool; count: number }[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Tools in the news"
      className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 ring-hairline"
    >
      <span className="shrink-0 font-mono text-[0.65rem] tracking-[0.2em] text-teal uppercase">
        Tools in the news
      </span>
      <div data-sweep-ignore className="min-w-0 flex-1 overflow-x-auto">
        <ul className="flex w-max gap-2">
          {items.map(({ tool, count }) => (
            <li key={tool.slug}>
              <Link
                href={`/tools/${tool.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm whitespace-nowrap transition-colors hover:border-teal/40"
              >
                <span className="font-medium">{tool.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {count} {count === 1 ? "story" : "stories"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
