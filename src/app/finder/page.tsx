import type { Metadata } from "next";
import { OracleFinder } from "@/components/finder/oracle-finder";
import { getAllTools, getCategories } from "@/lib/content";
import { siteConfig } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Ask the Oracle — find the right AI tool",
  description:
    "Answer three quick questions and Enki recommends the AI tools worth your trust, matched to your use case, budget, and platform.",
  path: "/finder",
  socialTitle: `Ask the Oracle · ${siteConfig.name}`,
});

export default async function FinderPage() {
  const tools = await getAllTools();
  const categoryNames = Object.fromEntries(
    (await getCategories()).map((c) => [c.slug, c.name]),
  );

  return <OracleFinder tools={tools} categoryNames={categoryNames} />;
}
