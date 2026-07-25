import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getToolBySlug } from "@/lib/content";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { ToolEditor } from "@/app/admin/tools/tool-editor";

export const metadata: Metadata = {
  title: "Edit tool",
  robots: { index: false, follow: false },
};

const NEW_TOOL_TEMPLATE = JSON.stringify(
  {
    slug: "new-tool",
    name: "New Tool",
    tagline: "One-line tagline",
    description: "A short description of the tool.",
    longDescription: "A longer description of what the tool does and who it's for.",
    website: "https://example.com",
    categorySlug: "writing",
    tags: ["tag"],
    pricing: { model: "freemium", startingPrice: "$10/mo", hasFreeTrial: true },
    pros: ["A strength"],
    cons: ["A limitation"],
    keyFeatures: [
      { title: "Feature", description: "What it does", icon: "Sparkles" },
    ],
    integrations: [],
    platforms: ["Web"],
    accent: "#00ADB5",
    featured: false,
    foundedYear: 2025,
    company: "Company name",
    screenshots: [{ title: "Screen", caption: "Caption", hue: 200 }],
    verdict: "Our editorial verdict.",
    editorScore: 7.5,
    rating: 4,
    reviewCount: 0,
  },
  null,
  2,
);

export default async function EditToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;

  let title: string;
  let editorProps: {
    slug: string | null;
    initialJson: string;
    initialPublished: boolean;
    existsInDb: boolean;
  };

  if (slug === "new") {
    title = "New tool";
    editorProps = {
      slug: null,
      initialJson: NEW_TOOL_TEMPLATE,
      initialPublished: true,
      existsInDb: false,
    };
  } else {
    const tool = await getToolBySlug(slug);
    if (!tool) notFound();
    const supabase = await createClient();
    const { data: dbRow } = await supabase
      .from("tools")
      .select("published")
      .eq("slug", slug)
      .maybeSingle();
    title = `Edit ${tool.name}`;
    editorProps = {
      slug,
      initialJson: JSON.stringify(tool, null, 2),
      initialPublished: dbRow?.published ?? true,
      existsInDb: Boolean(dbRow),
    };
  }

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Link
          href="/admin/tools"
          className="inline-flex w-fit items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <Icon name="ArrowLeft" className="size-3.5" />
          All tools
        </Link>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <ToolEditor {...editorProps} />
      </div>
    </Container>
  );
}
