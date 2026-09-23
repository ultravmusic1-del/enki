"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { safeExternalHref } from "@/lib/safe-url";
import { mergeStory } from "@/app/admin/news/actions";
import type { MergeTarget, QueueStory } from "@/app/admin/news/types";

/**
 * A rejected story can't be published, only merged back into a live or
 * pending story as one of its sources.
 */
export function RejectedStory({ story, mergeTargets }: { story: QueueStory; mergeTargets: MergeTarget[] }) {
  const [mergeInto, setMergeInto] = useState("");
  const [pending, startTransition] = useTransition();

  const merge = () =>
    startTransition(async () => {
      const res = await mergeStory(story.id, mergeInto);
      if (res.ok) toast.success("Merged");
      else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4 border-t border-border p-5">
      {story.excerpt ? (
        <div className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground">
          <p className="mb-1 font-mono text-[0.65rem] tracking-wide uppercase">
            Publisher excerpt, for reference only. Never published.
          </p>
          {story.excerpt}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {mergeTargets.length > 0 ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              aria-label="Merge into"
              className="h-10 w-auto max-w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none sm:max-w-72"
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
            >
              <option value="">Merge into…</option>
              {mergeTargets.map((t) => (
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
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to merge into yet.</p>
        )}
        <a
          href={safeExternalHref(story.sourceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {story.sourceName}
        </a>
      </div>
    </div>
  );
}
