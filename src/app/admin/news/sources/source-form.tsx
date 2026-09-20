"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addNewsSource } from "@/app/admin/news/actions";

const field =
  "h-10 w-full rounded-xl border border-input bg-background/60 px-3 text-sm focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none";

export function SourceForm() {
  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-3 rounded-2xl border border-border bg-card/60 p-5 ring-hairline md:grid-cols-[1fr_2fr_1.5fr_auto] md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const res = await addNewsSource({ name, feedUrl, siteUrl });
          if (res.ok) {
            toast.success(`Added ${name}`);
            setName("");
            setFeedUrl("");
            setSiteUrl("");
          } else {
            toast.error(res.error);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ars Technica" required />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Feed URL
        <input className={field} value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} placeholder="https://arstechnica.com/ai/feed/" inputMode="url" required />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        Site URL
        <input className={field} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://arstechnica.com" inputMode="url" required />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright disabled:opacity-60"
      >
        Add source
      </button>
    </form>
  );
}
