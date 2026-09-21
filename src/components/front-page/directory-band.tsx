import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { ToolCard } from "@/components/shared/tool-card";

const secondary =
  "inline-flex items-center rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground";

export function DirectoryBand({
  toolCount,
  categoryCount,
  featured,
}: {
  toolCount: number;
  categoryCount: number;
  featured: Tool[];
}) {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border bg-card px-6 py-10 ring-hairline sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">The directory</p>
          <h2 className="font-display text-3xl font-semibold text-balance">
            {toolCount} AI tools, vetted and scored
          </h2>
          <p className="text-pretty text-muted-foreground">
            Across {categoryCount} categories, each with an editor score.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tools"
            className="inline-flex items-center rounded-full bg-teal px-5 py-2 text-sm font-semibold text-[#04171a] transition-colors hover:bg-teal-bright"
          >
            Explore the directory
          </Link>
          <Link href="/categories" className={secondary}>
            Categories
          </Link>
          <Link href="/finder" className={secondary}>
            Ask the oracle
          </Link>
        </div>
      </div>
      {featured.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
