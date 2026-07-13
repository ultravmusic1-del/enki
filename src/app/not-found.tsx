import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center pt-28 text-center">
      <span
        className="emblem size-16 opacity-60"
        style={{
          color: "var(--brand-teal)",
          filter: "drop-shadow(0 0 24px rgb(var(--glow) / 0.5))",
        }}
        aria-hidden
      />
      <p className="mt-6 font-mono text-xs tracking-[0.3em] text-teal uppercase">
        404: Lost to the ether
      </p>
      <h1 className="mt-3 text-balance font-display text-4xl font-semibold sm:text-5xl">
        Even the oracle can&apos;t find this
      </h1>
      <p className="mt-4 max-w-md text-pretty text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s
        get you back to the tools worth trusting.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mist px-6 py-2.5 text-sm font-medium text-[#16191d] transition-transform hover:-translate-y-px hover:shadow-glow"
        >
          <Icon name="Home" className="size-4" />
          Back home
        </Link>
        <Link
          href="/tools"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
        >
          Browse the directory
        </Link>
      </div>
    </Container>
  );
}
