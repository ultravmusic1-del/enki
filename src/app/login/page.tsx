import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Enki to save tools and write reviews.",
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[80vh] items-center pt-28 pb-16">
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute inset-x-0 top-0 h-[420px]"
      />
      <Container className="relative">
        <div className="mx-auto max-w-md">
          <header className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
              <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
              Enki account
              <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
            </span>
            <h1 className="mt-3 font-display text-3xl leading-tight font-semibold sm:text-4xl">
              Save what you trust
            </h1>
            <p className="mt-3 text-pretty text-muted-foreground">
              An account syncs your saved tools across devices and lets you
              leave reviews. Free, no fluff.
            </p>
          </header>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </Container>
    </div>
  );
}
