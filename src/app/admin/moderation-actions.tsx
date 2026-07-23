"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setReviewStatus, type ReviewStatus } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ReviewStatus; label: string }[] = [
  { value: "approved", label: "Approve" },
  { value: "flagged", label: "Flag" },
  { value: "rejected", label: "Reject" },
];

export function ModerationActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending || status === opt.value}
          onClick={() =>
            startTransition(async () => {
              const res = await setReviewStatus(id, opt.value);
              if (res.ok) toast.success(`Review ${opt.value}`);
              else toast.error(res.error ?? "Could not update review");
            })
          }
          className={cn(
            "rounded-full border px-3 py-1 font-mono text-[0.65rem] tracking-wide uppercase transition-colors disabled:opacity-40",
            status === opt.value
              ? "border-teal/40 bg-teal/10 text-teal"
              : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
