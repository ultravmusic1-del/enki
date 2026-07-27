"use client";

import { useRef, useState } from "react";
import { unsubscribe } from "@/app/actions/unsubscribe";
import { Icon } from "@/components/shared/icon";

export function UnsubscribeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await unsubscribe(email);
    setBusy(false);
    if (result.ok) setDone(true);
    else setError(result.error);
  };

  if (done) {
    return (
      <div className="glass ring-hairline flex flex-col items-center gap-3 rounded-2xl border border-border p-8 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-teal/10 text-teal">
          <Icon name="BadgeCheck" className="size-6" />
        </span>
        <h2 className="font-display text-xl font-semibold">
          That address is unsubscribed
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          If it was on our list, it is not any more. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="glass ring-hairline flex flex-col gap-4 rounded-2xl border border-border p-6"
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
          Email
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          className="w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-teal/50 focus:ring-2 focus:ring-ring/40 focus:outline-none"
        />
      </label>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <Icon name="CircleX" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center justify-center rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] transition-all hover:-translate-y-0.5 hover:bg-teal-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Working…" : "Unsubscribe"}
      </button>
    </form>
  );
}
