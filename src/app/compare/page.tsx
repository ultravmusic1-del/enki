import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { CompareView } from "@/components/compare/compare-view";
import { getCompareTools } from "@/lib/content";

export const metadata: Metadata = {
  title: "Compare AI tools",
  description:
    "Put AI tools side by side — editor scores, community ratings, pricing, platforms, and the trade-offs — and decide which one to trust.",
};

export default function ComparePage() {
  const tools = getCompareTools();

  return (
    <div className="relative pt-28 pb-24">
      <Container className="relative">
        <header className="max-w-2xl">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-teal uppercase">
            <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
            Side by side
          </span>
          <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
            Compare tools
          </h1>
          <p className="mt-4 text-pretty text-muted-foreground">
            Line up to four tools and weigh them on the things that matter —
            our score, the community&apos;s verdict, pricing, and the honest
            trade-offs. Your selection lives in the URL, so a comparison is
            always a link away.
          </p>
        </header>

        {/* useSearchParams requires a Suspense boundary during prerender. */}
        <Suspense fallback={null}>
          <CompareView tools={tools} />
        </Suspense>
      </Container>
    </div>
  );
}
