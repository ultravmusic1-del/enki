import Link from "next/link";
import { ArticleBody } from "@/components/news/article-body";
import type { Issue } from "@/lib/news/issue";

const LABELS = ["Costs", "Platform risk", "Openings", "What to watch"];

export function TakeawayAnatomy({ issue }: { issue: Issue | null }) {
  const markdown = issue?.lead.founderMarkdown;
  if (!issue || !markdown) return null;
  return (
    <section aria-labelledby="takeaway-anatomy" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">The part you read it for</p>
        <h2 id="takeaway-anatomy" className="font-display text-3xl font-semibold text-balance uppercase">
          What &ldquo;for founders&rdquo; looks like.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every story closes with two to four points like these, drawn from the reporting and written for people running a company.
        </p>
        <ul className="flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <li key={l} className="rounded-full border border-teal-bright/25 px-3 py-1 font-mono text-[0.65rem] tracking-[0.14em] text-teal-bright uppercase">{l}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card/60 p-6 ring-hairline">
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">From today&apos;s lead story</p>
        <Link href={`/news/${issue.lead.slug}`} className="mt-2 block font-semibold text-pretty hover:text-teal-bright">
          {issue.lead.headline}
        </Link>
        <div className="mt-4">
          <ArticleBody body={markdown} />
        </div>
      </div>
    </section>
  );
}
