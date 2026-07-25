"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveTool, deleteTool } from "@/app/admin/tools/actions";
import { Icon } from "@/components/shared/icon";

export function ToolEditor({
  slug,
  initialJson,
  initialPublished,
  existsInDb,
}: {
  slug: string | null;
  initialJson: string;
  initialPublished: boolean;
  existsInDb: boolean;
}) {
  const router = useRouter();
  const [json, setJson] = useState(initialJson);
  const [published, setPublished] = useState(initialPublished);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveTool(json, published);
      if (res.ok) {
        toast.success("Saved");
        router.push("/admin/tools");
        router.refresh();
      } else {
        setError(res.error);
        toast.error("Could not save — see the error below");
      }
    });

  const onDelete = () => {
    if (!slug) return;
    startTransition(async () => {
      const res = await deleteTool(slug);
      if (res.ok) {
        toast.success("Reverted to seed / removed");
        router.push("/admin/tools");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not delete");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="size-4 accent-teal"
        />
        Published (visible on the public site)
      </label>

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        spellCheck={false}
        rows={26}
        className="w-full rounded-xl border border-input bg-background/60 p-4 font-mono text-xs leading-relaxed text-foreground focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
      />

      {error && (
        <pre className="overflow-x-auto rounded-xl border border-destructive/30 bg-destructive/10 p-4 font-mono text-xs whitespace-pre-wrap text-destructive">
          {error}
        </pre>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] shadow-glow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-bright disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save tool"}
          <Icon name="Check" className="size-4" />
        </button>
        {existsInDb && slug && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
          >
            <Icon name="Minus" className="size-4" />
            Remove DB override
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        The full tool object is validated against the content schema on save.
        Editing an existing tool writes a database override; removing it reverts
        to the git-versioned seed.
      </p>
    </div>
  );
}
