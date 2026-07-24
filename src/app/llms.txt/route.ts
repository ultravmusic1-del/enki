import { getAllTools, getCategories } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";

/** Plain-text site guide following the llms.txt convention. */
export function GET() {
  const base = siteConfig.url;
  const categories = getCategories();
  const tools = getAllTools();

  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    "## Categories",
    ...categories.map(
      (c) => `- [${c.name}](${base}/best/${c.slug}): ${c.tagline}`,
    ),
    "",
    "## Tools",
    ...tools.map((t) => `- [${t.name}](${base}/tools/${t.slug}): ${t.tagline}`),
    "",
    "## Key pages",
    `- [Directory](${base}/tools): browse and filter every vetted tool`,
    `- [Finder](${base}/finder): guided recommendations`,
    `- [Compare](${base}/compare): put tools head to head`,
    `- [Leaderboards](${base}/leaderboards): top tools by editor and community score`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
