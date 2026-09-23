"use client";

import { useState, useTransition, type Ref } from "react";
import { toast } from "sonner";
import { beats, type BeatSlug } from "@/data/beats";
import {
  BODY_MAX_WORDS,
  BODY_MIN_WORDS,
  FOUNDER_HEADING,
  SUMMARY_MAX,
  SUMMARY_MIN,
  bodyProblems,
  countWords,
} from "@/lib/news/schemas";
import { safeExternalHref } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { mergeStory, publishStory, setStoryStatus } from "@/app/admin/news/actions";
import { ToolPicker } from "@/app/admin/news/tool-picker";
import type { MergeTarget, QueueStory, ToolOption } from "@/app/admin/news/types";

const field =
  "w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none";

export function StoryEditor({
  story,
  tools,
  view,
  mergeTargets,
  formRef,
}: {
  story: QueueStory;
  tools: ToolOption[];
  view: "pending" | "published";
  mergeTargets: MergeTarget[];
  formRef: Ref<HTMLFormElement>;
}) {
  const [headline, setHeadline] = useState(story.headline);
  const [summary, setSummary] = useState(story.summary);
  const [body, setBody] = useState(story.body);
  const [beat, setBeat] = useState<BeatSlug | "">(story.beat);
  const [featured, setFeatured] = useState(story.featured);
  const [toolSlugs, setToolSlugs] = useState(story.toolSlugs);
  const [pending, startTransition] = useTransition();
  const [mergeInto, setMergeInto] = useState("");

  const summaryLength = summary.trim().length;
  const summaryOk = summaryLength >= SUMMARY_MIN && summaryLength <= SUMMARY_MAX;
  const words = countWords(body);
  const problems = body.trim() ? bodyProblems(body) : [];
  const wordsOk = words >= BODY_MIN_WORDS && words <= BODY_MAX_WORDS;

  const secondary = () =>
    startTransition(async () => {
      const res = await setStoryStatus(story.id, view === "pending" ? "rejected" : "pending");
      if (res.ok) toast.success(view === "pending" ? "Rejected" : "Unpublished");
      else toast.error(res.error);
    });

  const merge = () =>
    startTransition(async () => {
      const res = await mergeStory(story.id, mergeInto);
      if (res.ok) toast.success("Merged");
      else toast.error(res.error);
    });

  const unmerge = (id: string) =>
    startTransition(async () => {
      const res = await setStoryStatus(id, "pending");
      if (res.ok) toast.success("Unmerged");
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
          const res = await publishStory({ id: story.id, headline, summary, body, beat, featured, toolSlugs });
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

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3 text-sm">
        <p className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
          Sources to read before writing ({story.sources.length + 1})
        </p>
        <ul className="flex flex-col gap-1.5">
          <li className="min-w-0">
            <a href={safeExternalHref(story.sourceUrl)} target="_blank" rel="noopener noreferrer" className="break-words hover:text-teal">
              {story.sourceName}
            </a>
          </li>
          {story.sources.map((s) => (
            <li key={s.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <a href={safeExternalHref(s.sourceUrl)} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words hover:text-teal">
                {s.sourceName}
              </a>
              <button type="button" disabled={pending} onClick={() => unmerge(s.id)} className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60">
                Unmerge
              </button>
            </li>
          ))}
        </ul>
      </div>

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
        <span className="flex flex-wrap justify-between gap-2">
          Story ({BODY_MIN_WORDS} to {BODY_MAX_WORDS} words, ending with &ldquo;## {FOUNDER_HEADING}&rdquo;)
          <span className={cn("tabular-nums", body.trim() === "" || wordsOk ? "text-muted-foreground" : "text-destructive")}>
            {words} words
          </span>
        </span>
        <textarea className={cn(field, "min-h-96 font-mono text-[0.8rem] leading-relaxed")} value={body} onChange={(e) => setBody(e.target.value)} />
        {problems.length > 0 ? (
          <ul className="flex flex-col gap-0.5 text-destructive">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
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
          {view === "pending" ? "Publish" : "Save"} <kbd aria-hidden="true" className="ml-2 font-mono text-[0.65rem] opacity-70">P</kbd>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={secondary}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
        >
          {view === "pending" ? (
            <>
              Reject <kbd aria-hidden="true" className="ml-2 font-mono text-[0.65rem] opacity-70">R</kbd>
            </>
          ) : (
            "Unpublish"
          )}
        </button>
        {view === "pending" && mergeTargets.length > 1 ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              aria-label="Merge into"
              className={cn(field, "h-10 w-auto max-w-full sm:max-w-72")}
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
            >
              <option value="">Merge into…</option>
              {mergeTargets
                .filter((t) => t.id !== story.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.headline}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={pending || !mergeInto}
              onClick={merge}
              className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm text-muted-foreground hover:border-teal/40 hover:text-foreground disabled:opacity-60"
            >
              Merge
            </button>
          </span>
        ) : null}
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
