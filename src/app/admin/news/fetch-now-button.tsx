"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/shared/icon";
import { fetchNewsNow } from "@/app/admin/news/actions";

export function FetchNowButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await fetchNewsNow();
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const { sources, fetched, inserted, failed } = res.summary;
          const message = `${inserted} new of ${fetched} items from ${sources} sources`;
          if (failed.length > 0) toast.warning(`${message}. Failed: ${failed.join(", ")}`);
          else toast.success(message);
        })
      }
      className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright disabled:opacity-60"
    >
      <Icon name="RotateCcw" className={pending ? "size-4 animate-spin" : "size-4"} />
      {pending ? "Fetching…" : "Fetch now"}
    </button>
  );
}
