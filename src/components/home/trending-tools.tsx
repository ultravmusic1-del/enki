import Link from "next/link";
import { ToolCard } from "@/components/shared/tool-card";
import type { Tool } from "@/lib/schemas";

export function TrendingTools({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="trending-tools" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Stay current</p>
          <h2 id="trending-tools" className="font-display text-3xl font-semibold uppercase">Tools worth knowing.</h2>
          <p className="text-sm text-muted-foreground">The products our stories keep coming back to.</p>
        </div>
        <Link href="/tools" className="text-sm font-semibold text-teal hover:text-teal-bright">Browse all tools &rarr;</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
