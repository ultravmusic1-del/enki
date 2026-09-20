"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setStoryStatus } from "@/app/admin/news/actions";
import { StoryEditor } from "@/app/admin/news/story-editor";
import type { QueueStory, ToolOption } from "@/app/admin/news/types";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function NewsQueue({
  stories,
  tools,
  view,
}: {
  stories: QueueStory[];
  tools: ToolOption[];
  view: "pending" | "published";
}) {
  const [activeId, setActiveId] = useState<string | null>(stories[0]?.id ?? null);
  const [, startTransition] = useTransition();
  const forms = useRef(new Map<string, HTMLFormElement>());

  // Derived, not synced in an effect: when the active story is published or
  // rejected it drops out of `stories`, and the first remaining one takes over.
  const currentId = stories.some((s) => s.id === activeId) ? activeId : (stories[0]?.id ?? null);

  const reject = useCallback((id: string) => {
    startTransition(async () => {
      const res = await setStoryStatus(id, "rejected");
      if (res.ok) toast.success("Rejected");
      else toast.error(res.error);
    });
  }, []);

  const move = useCallback(
    (delta: number) => {
      const index = stories.findIndex((s) => s.id === currentId);
      const next = stories[Math.min(Math.max(index + delta, 0), stories.length - 1)];
      if (!next) return;
      setActiveId(next.id);
      requestAnimationFrame(() =>
        document.getElementById(`story-${next.id}`)?.scrollIntoView({ block: "nearest" }),
      );
    },
    [stories, currentId],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "j") {
        event.preventDefault();
        move(1);
      } else if (key === "k") {
        event.preventDefault();
        move(-1);
      } else if (key === "p" && currentId) {
        event.preventDefault();
        forms.current.get(currentId)?.requestSubmit();
      } else if (key === "r" && currentId && view === "pending") {
        event.preventDefault();
        reject(currentId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, reject, currentId, view]);

  if (stories.length === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground ring-hairline">
        {view === "pending"
          ? "The queue is empty. Fetch now, or wait for tomorrow's run."
          : "Nothing published yet."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {stories.map((story) => {
        const open = story.id === currentId;
        return (
          <li
            key={story.id}
            id={`story-${story.id}`}
            className={cn(
              "overflow-hidden rounded-2xl border bg-card/60 ring-hairline transition-colors",
              open ? "border-teal/40" : "border-border",
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setActiveId(story.id)}
              className="flex w-full flex-col gap-1 p-5 text-left"
            >
              <span className="font-medium text-pretty">{story.headline}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {story.sourceName} · {story.age}
                {story.toolSlugs.length > 0 ? ` · ${story.toolSlugs.length} tool(s)` : ""}
              </span>
            </button>
            {open ? (
              <StoryEditor
                key={story.id}
                story={story}
                tools={tools}
                view={view}
                formRef={(el) => {
                  if (el) forms.current.set(story.id, el);
                  else forms.current.delete(story.id);
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
