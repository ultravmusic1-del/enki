import type { Metadata } from "next";
import { Suspense } from "react";
import { OracleFinder } from "@/components/finder/oracle-finder";
import { getAllTools, getCategories } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ask the Oracle — find the right AI tool",
  description:
    "Answer three quick questions and Enki recommends the AI tools worth your trust, matched to your use case, budget, and platform.",
  alternates: { canonical: "/finder" },
  openGraph: {
    title: `Ask the Oracle · ${siteConfig.name}`,
    description:
      "Guided recommendations for the AI tools worth your trust — matched to your use case, budget, and platform.",
    type: "website",
  },
};

export default function FinderPage() {
  const tools = getAllTools();
  const categoryNames = Object.fromEntries(
    getCategories().map((c) => [c.slug, c.name]),
  );

  return (
    <Suspense>
      <OracleFinder tools={tools} categoryNames={categoryNames} />
    </Suspense>
  );
}
