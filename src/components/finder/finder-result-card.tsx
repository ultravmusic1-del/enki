import type { Tool } from "@/lib/schemas";
import { SavableToolCard } from "@/components/shared/savable-tool-card";
import { Icon } from "@/components/shared/icon";

/**
 * A finder result: the standard directory card with a row of "why this" reason
 * chips above it, so the recommendation reads as reasoned rather than random.
 */
export function FinderResultCard({
  tool,
  categoryName,
  reasons,
}: {
  tool: Tool;
  categoryName?: string;
  reasons: string[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {reasons.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Why we recommend this">
          {reasons.map((reason) => (
            <li
              key={reason}
              className="inline-flex items-center gap-1 rounded-full border border-teal/25 bg-teal/10 px-2.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-teal"
            >
              <Icon name="Check" className="size-3" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      <SavableToolCard tool={tool} categoryName={categoryName} className="flex-1" />
    </div>
  );
}
