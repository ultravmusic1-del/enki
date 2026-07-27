import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { UnsubscribeForm } from "@/components/account/unsubscribe-form";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Remove your email address from the Enki newsletter.",
  alternates: { canonical: "/unsubscribe" },
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Newsletter
          </p>
          <h1 className="text-balance font-display text-3xl font-semibold">
            Unsubscribe
          </h1>
          <p className="text-pretty text-muted-foreground">
            Enter the address you signed up with and we will stop emailing it.
            Enki has not sent a newsletter yet, so this takes effect before the
            first one goes out.
          </p>
        </header>

        <UnsubscribeForm />
      </div>
    </Container>
  );
}
