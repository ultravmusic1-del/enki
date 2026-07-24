import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { ToolCard } from "@/components/shared/tool-card";
import { createClient } from "@/lib/supabase/server";
import { getToolBySlug, getCategories } from "@/lib/content";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

async function loadList(id: string) {
  const supabase = await createClient();
  // RLS returns the collection only when it is public.
  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!collection) return null;

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("collection_items")
      .select("tool_slug, note, created_at")
      .eq("collection_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", collection.user_id)
      .maybeSingle(),
  ]);

  return {
    name: collection.name,
    curator: profile?.display_name ?? "an Enki member",
    items: items ?? [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const list = await loadList(id);
  if (!list) return { title: "List not found" };
  return {
    title: `${list.name} — an AI tool collection`,
    description: `${list.name}: a curated collection of AI tools on ${siteConfig.name}.`,
    alternates: { canonical: `/lists/${id}` },
  };
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const list = await loadList(id);
  if (!list) notFound();

  const categoryName = new Map(getCategories().map((c) => [c.slug, c.name]));
  const entries = list.items
    .map((it) => ({ tool: getToolBySlug(it.tool_slug), note: it.note }))
    .filter((e): e is { tool: NonNullable<typeof e.tool>; note: string | null } =>
      Boolean(e.tool),
    );

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Collection
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold sm:text-5xl">
            {list.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Curated by {list.curator} · {entries.length}{" "}
            {entries.length === 1 ? "tool" : "tools"}
          </p>
        </header>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This collection is empty.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {entries.map(({ tool, note }) => (
              <div key={tool.slug} className="flex flex-col gap-2">
                <ToolCard
                  tool={tool}
                  categoryName={categoryName.get(tool.categorySlug)}
                />
                {note && (
                  <p className="flex items-start gap-2 rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-pretty text-muted-foreground">
                    <Icon name="Quote" className="mt-0.5 size-3.5 shrink-0 text-teal" />
                    {note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border pt-6">
          <Link
            href="/tools"
            className="inline-flex items-center gap-1.5 text-sm text-teal hover:underline"
          >
            Discover more AI tools on {siteConfig.name}
            <Icon name="ArrowRight" className="size-4" />
          </Link>
        </div>
      </div>
    </Container>
  );
}
