import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { EditorScore } from "@/components/shared/editor-score";
import { Icon } from "@/components/shared/icon";
import { FindToolButton } from "@/components/front-page/find-tool-button";
import { cn } from "@/lib/utils";

export function HomeSidebar({ topTools, className }: { topTools: Tool[]; className?: string }) {
  return (
    <aside className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 ring-hairline", className)}>
      <FindToolButton />
      <h2 className="font-mono text-xs tracking-[0.2em] text-teal uppercase">From the directory</h2>
      <ul className="flex flex-col divide-y divide-border">
        {topTools.map((tool) => (
          <li key={tool.slug} className="flex items-center justify-between gap-3 py-2.5">
            <Link href={`/tools/${tool.slug}`} className="min-w-0 truncate font-medium hover:text-teal">
              {tool.name}
            </Link>
            <EditorScore value={tool.editorScore} />
          </li>
        ))}
      </ul>
      <Link href="/finder" className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal-bright">
        Ask the oracle
        <Icon name="ArrowRight" className="size-3.5" />
      </Link>
    </aside>
  );
}
