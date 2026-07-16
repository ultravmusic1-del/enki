"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        router.push(redirectTo);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() || undefined },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation disabled — straight in.
          toast.success("Account created");
          router.push(redirectTo);
          router.refresh();
        } else {
          // Confirmation required.
          setCheckEmail(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <div className="glass ring-hairline rounded-2xl border border-border p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal/10 text-teal">
          <Icon name="BadgeCheck" className="size-7" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold">
          Confirm your email
        </h1>
        <p className="mt-2 text-pretty text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="text-foreground">{email}</span>. Click it to finish
          creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="glass ring-hairline rounded-2xl border border-border p-6 sm:p-8">
      {/* Mode toggle */}
      <div className="relative grid grid-cols-2 gap-1 rounded-full bg-muted/50 p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-full bg-teal/15 shadow-[inset_0_0_0_1px_rgb(var(--glow)/0.4)] transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.2,0.64,1)]"
          style={{
            width: "calc(50% - 0.25rem)",
            transform: `translateX(${mode === "signup" ? "calc(100% + 0.25rem)" : "0"})`,
          }}
        />
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "relative z-10 rounded-full py-2 text-sm font-medium transition-colors",
              mode === m
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {mode === "signup" && (
          <Field label="Name" optional>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should we credit you?"
              autoComplete="name"
              className={inputClass}
            />
          </Field>
        )}

        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            className={inputClass}
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <Icon name="CircleX" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] shadow-glow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-bright disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        By continuing you agree to browse responsibly. Enki is in preview.{" "}
        <Link href="/" className="text-teal hover:underline">
          Back home
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-input bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-ring/40";

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
        {optional && <span className="ml-1 opacity-60">(optional)</span>}
      </span>
      {children}
    </label>
  );
}
