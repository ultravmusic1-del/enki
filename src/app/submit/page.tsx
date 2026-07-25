import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { SubmitForm } from "@/components/submit/submit-form";
import { getCategories } from "@/lib/content";

export const metadata: Metadata = {
  title: "Submit a tool",
  description:
    "Know an AI tool worth vetting? Submit it and our editors will review it for the Enki directory.",
  alternates: { canonical: "/submit" },
};

export default async function SubmitPage() {
  const categories = (await getCategories()).map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-xl flex-col gap-8">
        <header className="flex flex-col gap-3 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Submit
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            Suggest a tool
          </h1>
          <p className="text-pretty text-muted-foreground">
            Found an AI tool the directory is missing? Tell us about it. Every
            submission is reviewed and vetted by our editors before it&apos;s
            listed — nothing is published automatically.
          </p>
        </header>

        <SubmitForm categories={categories} />
      </div>
    </Container>
  );
}
