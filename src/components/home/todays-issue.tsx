import Link from "next/link";
import type { BeatSlug } from "@/data/beats";
import type { Issue } from "@/lib/news/issue";
import { StoryImage } from "@/components/front-page/story-image";

const BEAT_COLOUR: Record<BeatSlug, string> = {
  "models-labs": "#7c9cff",
  "products-launches": "#b58cff",
  "funding-business": "#6ed39a",
  "policy-safety": "#f0a35e",
  research: "#35e4ec",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function TodaysIssue({ issue }: { issue: Issue | null }) {
  if (!issue) return null;
  const remaining = issue.totalCount - issue.stories.length;

  return (
    <section aria-labelledby="todays-issue" className="relative">
      <h2 id="todays-issue" className="sr-only">Today&apos;s brief</h2>
      <div className="mx-auto max-w-4xl rounded-[1.1rem] bg-[linear-gradient(135deg,rgba(53,228,236,0.45),rgba(42,49,59,0.6)_35%,rgba(42,49,59,0.6)_70%,rgba(0,173,181,0.35))] p-px shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
        <div className="overflow-hidden rounded-[calc(1.1rem-1px)] bg-[linear-gradient(180deg,#1d232c,#191e25)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="font-display text-base font-semibold uppercase">Enki Daily</span>
              <span className="font-mono text-[0.65rem] tracking-[0.18em] text-teal uppercase">Today&apos;s brief</span>
            </div>
            <span className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
              {`${issue.dateLabel} · ${issue.totalCount} stories · ${issue.minutes} min`}
            </span>
          </div>

          <ol>
            {issue.stories.map((story, i) => (
              <li key={story.slug} className="border-b border-border last:border-b-0">
                <Link
                  href={`/news/${story.slug}`}
                  className="group grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 px-5 py-5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[3rem_minmax(0,1fr)_11rem] sm:gap-x-5 sm:px-6"
                >
                  <StoryImage
                    src={story.imageUrl}
                    label={story.beatName}
                    className="col-span-2 w-full sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:self-start"
                  />
                  <span aria-hidden="true" className="font-display text-2xl font-semibold text-transparent [-webkit-text-stroke:1px_#3b4552] group-hover:[-webkit-text-stroke:1px_#35e4ec] sm:col-start-1 sm:row-start-1">
                    {pad(i + 1)}
                  </span>
                  <span className="min-w-0 sm:col-start-2 sm:row-start-1">
                    <span className="inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                      <i aria-hidden="true" className="inline-block size-1.5 rounded-[2px]" style={{ background: BEAT_COLOUR[story.beat] }} />
                      {story.beatName}
                    </span>
                    <span className="mt-1.5 block text-base font-semibold text-pretty break-words text-foreground group-hover:text-teal-bright">
                      {story.headline}
                    </span>
                    <span className="mt-2 block text-sm leading-relaxed text-pretty text-[#d3dae1]">
                      <b className="font-semibold text-teal-bright">For founders &rarr; </b>
                      <span>{story.takeaway}</span>
                    </span>
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {story.outlets.map((o) => (
                        <span key={o} className="rounded-md border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{o}</span>
                      ))}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-teal/[0.06] px-5 py-3 sm:px-6">
            <span className="text-sm text-muted-foreground">
              {remaining > 0 ? `And ${remaining} more ${remaining === 1 ? "story" : "stories"} in today's brief.` : ""}
            </span>
            <Link href="/news" className="text-sm font-semibold text-teal-bright hover:underline">
              Read today&apos;s stories &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
