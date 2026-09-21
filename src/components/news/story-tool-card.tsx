import Link from "next/link";
import type { Tool } from "@/lib/schemas";
import { ToolLogo } from "@/components/shared/tool-logo";
import { EditorScore } from "@/components/shared/editor-score";
import { Icon } from "@/components/shared/icon";
import { outboundHref, resolveOutboundTarget } from "@/lib/outbound";

/**
 * A tool mentioned in a story. The name links to Enki's own review; the CTA
 * goes out through /go/[slug], so the click is tracked and, where the tool has
 * an affiliate URL, commissioned.
 */
export function StoryToolCard({ tool }: { tool: Tool }) {
  const { isAffiliate } = resolveOutboundTarget(tool);
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 ring-hairline">
      <div className="flex items-center gap-3">
        <ToolLogo name={tool.name} accent={tool.accent} logo={tool.logo} size="sm" />
        <div className="min-w-0">
          <Link
            href={`/tools/${tool.slug}`}
            className="font-display text-lg leading-tight font-semibold break-words hover:text-teal"
          >
            {tool.name}
          </Link>
          <p className="text-sm text-pretty text-muted-foreground">{tool.tagline}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <EditorScore value={tool.editorScore} />
        <a
          href={outboundHref(tool.slug)}
          target="_blank"
          rel={isAffiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-teal px-4 text-sm font-semibold text-[#04171a] transition-colors hover:bg-teal-bright"
        >
          Visit {tool.name}
          <Icon name="ArrowUpRight" className="size-4" />
        </a>
      </div>
    </div>
  );
}
