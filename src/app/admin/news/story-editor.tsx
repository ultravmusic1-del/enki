"use client";

import { useState, useTransition, type Ref } from "react";
import { toast } from "sonner";
import { beats, type BeatSlug } from "@/data/beats";
import { isIndexableTake, SUMMARY_MAX, SUMMARY_MIN } from "@/lib/news/schemas";
import { safeExternalHref } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { publishStory, setStoryStatus } from "@/app/admin/news/actions";
import { ToolPicker } from "@/app/admin/news/tool-picker";
import type { QueueStory, ToolOption } from "@/app/admin/news/types";

const field =
  "w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none";

export function StoryEditor({
  story,
  tools,
  view,
  formRef,
}: {
  story: QueueStory;
  tools: ToolOption[];
  view: "pending" | "published";
  formRef: Ref<HTMLFormElement>;
}) {
  const [headline, setHeadline] = useState(story.headline);
  const [summary, setSummary] = useState(story.summary);
  const [take, setTake] = useState(story.take);
  const [beat, setBeat] = useState<BeatSlug | "">(story.beat);
  const [featured, setFeatured] = useState(story.featured);
  const [toolSlugs, setToolSlugs] = useState(story.toolSlugs);
  const [pending, startTransition] = useTransition();

  const summaryLength = summary.trim().length;
  const summaryOk = summaryLength >= SUMMARY_MIN && summaryLength <= SUMMARY_MAX;

  const secondary = () =>
    startTransition(async () => {
      const res = await setStoryStatus(story.id, view === "pending" ? "rejected" : "pending");
      if (res.ok) toast.success(view === "pending" ? "Rejected" : "Unpublished");
      else toast.error(res.error);
    });

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4 border-t border-border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!beat) {
          toast.error("Pick a beat.");
          return;
        }
        startTransition(async () => {
          const res = await publishStory({ id: story.id, headline, summary, take, beat, featured, toolSlugs });
          if (res.ok) toast.success(view === "pending" ? "Published" : "Saved");
          else toast.error(res.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Headline
        <input className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </label>

      {story.excerpt ? (
        <div className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">
          <p className="mb-1 font-mono text-[0.65rem] tracking-wide uppercase">
            Publisher excerpt, for reference only. Never published.
          </p>
          {story.excerpt}
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex justify-between">
          Your summary
          <span className={cn("tabular-nums", summaryOk ? "text-muted-foreground" : "text-destructive")}>
            {summaryLength}/{SUMMARY_MAX}
          </span>
        </span>
        <textarea className={cn(field, "min-h-24")} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex justify-between">
          Your take (optional)
          {isIndexableTake(take) ? (
            <span className="text-teal">Indexable</span>
          ) : (
            <span>300+ characters makes the page indexable</span>
          )}
        </span>
        <textarea className={cn(field, "min-h-20")} value={take} onChange={(e) => setTake(e.target.value)} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          Beat
          <select className={cn(field, "h-10")} value={beat} onChange={(e) => setBeat(e.target.value as BeatSlug | "")}>
            <option value="">Pick a beat</option>
            {beats.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" className="size-4 accent-teal" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Feature as the lead story
        </label>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Tools in this story
        <ToolPicker value={toolSlugs} onChange={setToolSlugs} tools={tools} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright disabled:opacity-60"
        >
          {view === "pending" ? "Publish" : "Save"} <kbd className="ml-2 font-mono text-[0.65rem] opacity-70">P</kbd>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={secondary}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
        >
          {view === "pending" ? (
            <>
              Reject <kbd className="ml-2 font-mono text-[0.65rem] opacity-70">R</kbd>
            </>
          ) : (
            "Unpublish"
          )}
        </button>
        <a
          href={safeExternalHref(story.sourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Open original
        </a>
      </div>
    </form>
  );
}
