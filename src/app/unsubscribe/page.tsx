import type { Metadata } from "next";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "How to stop receiving Enki Daily.",
  alternates: { canonical: "/unsubscribe" },
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-md flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki Daily</p>
        <h1 className="text-balance font-display text-3xl font-semibold">Unsubscribing from Enki Daily</h1>
        <p className="text-pretty text-muted-foreground">
          Every Enki Daily email has a one-click unsubscribe link at the bottom. Use it and you&apos;ll stop receiving
          emails right away.
        </p>
      </div>
    </Container>
  );
}
