"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  setSubmissionStatus,
  type SubmissionStatus,
} from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: "approved", label: "Approve" },
  { value: "rejected", label: "Reject" },
  { value: "pending", label: "Reset" },
];

export function SubmissionActions({
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
              const res = await setSubmissionStatus(id, opt.value);
              if (res.ok) toast.success(`Submission ${opt.value}`);
              else toast.error(res.error ?? "Could not update submission");
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
