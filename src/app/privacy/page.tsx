import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} handles your data.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Legal
          </p>
          <h1 className="font-display text-4xl font-semibold">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Enki is in preview. This policy describes our current practices and
            may change as the product matures.
          </p>
        </header>

        <section className="flex flex-col gap-3 text-pretty text-muted-foreground">
          <h2 className="font-display text-xl font-semibold text-foreground">
            What we collect
          </h2>
          <p>
            If you create an account we store the email address and optional
            display name you provide, and the tools you save or review.
            Anonymous, cookieless usage analytics are collected via Vercel
            Analytics to help us improve the site.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            How we use it
          </h2>
          <p>
            To operate your account, attribute your reviews, sync your saved
            tools across devices, and understand aggregate usage. We do not sell
            your personal data.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            Your choices
          </h2>
          <p>
            You can request deletion of your account and associated data at any
            time by contacting us at{" "}
            <a
              className="text-teal hover:underline"
              href="mailto:hello@enki.tools"
            >
              hello@enki.tools
            </a>
            . Newsletter subscriptions can be cancelled at any time.
          </p>

          <h2
            id="affiliate"
            className="mt-4 scroll-mt-28 font-display text-xl font-semibold text-foreground"
          >
            Affiliate links
          </h2>
          <p>
            Some outbound links to tools are affiliate links, meaning Enki may
            earn a commission if you sign up or purchase through them, at no
            extra cost to you. Affiliate relationships never influence our editor
            scores, verdicts, or rankings — those are decided independently
            before any commercial arrangement.
          </p>
        </section>
      </div>
    </Container>
  );
}
