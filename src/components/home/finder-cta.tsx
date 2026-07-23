import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";

/**
 * Home-page band inviting visitors into the guided finder. On-brand: a glass
 * panel with the emblem and a single primary action.
 */
export function FinderCta() {
  return (
    <Container className="py-16">
      <div className="relative overflow-hidden rounded-3xl border border-teal/20 bg-card p-8 text-center ring-hairline sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgb(var(--glow) / 0.10), transparent 70%)",
          }}
        />
        <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
          <span
            className="emblem size-9"
            style={{ color: "var(--brand-teal)" }}
            aria-hidden
          />
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Not sure where to start?
          </p>
          <h2 className="text-balance font-display text-3xl font-semibold sm:text-4xl">
            Let the Oracle choose for you
          </h2>
          <p className="max-w-md text-pretty text-muted-foreground">
            Three quick questions — your use case, budget, and platform — and
            we&apos;ll name the tools worth your trust.
          </p>
          <Link
            href="/finder"
            className="group mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-teal px-6 text-sm font-semibold text-[#04171a] shadow-glow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-bright hover:shadow-glow"
          >
            Ask the Oracle
            <Icon
              name="ArrowRight"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </div>
    </Container>
  );
}
