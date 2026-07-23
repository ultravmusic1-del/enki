import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms for using ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Legal
          </p>
          <h1 className="font-display text-4xl font-semibold">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Enki is in preview and provided on an &ldquo;as is&rdquo; basis.
          </p>
        </header>

        <section className="flex flex-col gap-3 text-pretty text-muted-foreground">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Using Enki
          </h2>
          <p>
            Enki is a curated directory of AI tools. Editorial scores and
            reviews are our opinion and provided for information only. Verify
            pricing and capabilities on each tool&rsquo;s own site before relying
            on them.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            Your contributions
          </h2>
          <p>
            You are responsible for the reviews and content you submit, and you
            grant us a licence to display them on the site. Keep contributions
            lawful and respectful.
          </p>

          <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
            Liability
          </h2>
          <p>
            To the fullest extent permitted by law, Enki is not liable for
            decisions made based on content on this site. Questions?{" "}
            <a
              className="text-teal hover:underline"
              href="mailto:hello@enki.tools"
            >
              hello@enki.tools
            </a>
            .
          </p>
        </section>
      </div>
    </Container>
  );
}
