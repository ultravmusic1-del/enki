"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setNewsSourceActive } from "@/app/admin/news/actions";
import { cn } from "@/lib/utils";

export function SourceToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={active}
      onClick={() =>
        startTransition(async () => {
          const res = await setNewsSourceActive(id, !active);
          if (!res.ok) toast.error(res.error);
        })
      }
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-wide uppercase transition-colors disabled:opacity-40",
        active
          ? "border-teal/40 bg-teal/10 text-teal"
          : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
      )}
    >
      {active ? "Active" : "Paused"}
    </button>
  );
}
