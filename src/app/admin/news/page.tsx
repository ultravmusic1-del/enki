import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllTools } from "@/lib/content";
import { getBeat } from "@/data/beats";
import { formatAge } from "@/lib/news/format-age";
import { cn } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { NewsQueue } from "@/app/admin/news/news-queue";
import { FetchNowButton } from "@/app/admin/news/fetch-now-button";
import type { MergeTarget, QueueSource, QueueStory } from "@/app/admin/news/types";

export const metadata: Metadata = {
  title: "News queue",
  robots: { index: false, follow: false },
};

type View = "pending" | "published";

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireAdmin();
  const view: View = (await searchParams).view === "published" ? "published" : "pending";

  const supabase = await createClient();
  const columns =
    "id, headline, source_id, source_url, image_url, summary, take, body, beat, featured, slug, source_published_at, published_at, created_at";
  const storiesQuery =
    view === "pending"
      ? supabase.from("stories").select(columns).eq("status", "pending").order("created_at", { ascending: false }).limit(100)
      : supabase.from("stories").select(columns).eq("status", "published").order("published_at", { ascending: false }).limit(50);

  const [{ data: storyRows }, { data: sourceRows }, allTools] = await Promise.all([
    storiesQuery,
    supabase.from("news_sources").select("id, name"),
    getAllTools(),
  ]);

  const rows = storyRows ?? [];
  const ids = rows.map((r) => r.id);
  const [excerptRes, toolRes, childRes] =
    ids.length > 0
      ? await Promise.all([
          supabase.from("story_excerpts").select("story_id, excerpt").in("story_id", ids),
          supabase.from("story_tools").select("story_id, tool_slug, position").in("story_id", ids).order("position"),
          supabase.from("stories").select("id, merged_into, source_name, source_url").eq("status", "merged").in("merged_into", ids),
        ])
      : [
          { data: [] as { story_id: string; excerpt: string }[] },
          { data: [] as { story_id: string; tool_slug: string; position: number }[] },
          { data: [] as { id: string; merged_into: string | null; source_name: string; source_url: string }[] },
        ];

  const sourceName = new Map((sourceRows ?? []).map((s) => [s.id, s.name]));
  const excerptOf = new Map((excerptRes.data ?? []).map((e) => [e.story_id, e.excerpt]));
  const toolsOf = new Map<string, string[]>();
  for (const t of toolRes.data ?? []) {
    toolsOf.set(t.story_id, [...(toolsOf.get(t.story_id) ?? []), t.tool_slug]);
  }

  const sourcesOf = new Map<string, QueueSource[]>();
  for (const c of childRes.data ?? []) {
    if (!c.merged_into) continue;
    sourcesOf.set(c.merged_into, [
      ...(sourcesOf.get(c.merged_into) ?? []),
      { id: c.id, sourceName: c.source_name, sourceUrl: c.source_url },
    ]);
  }

  const { data: publishedTargets } =
    view === "pending"
      ? await supabase.from("stories").select("id, headline").eq("status", "published").order("published_at", { ascending: false }).limit(30)
      : { data: [] as { id: string; headline: string }[] };

  const now = new Date();
  const stories: QueueStory[] = rows.map((r) => ({
    id: r.id,
    headline: r.headline,
    sourceName: sourceName.get(r.source_id) ?? "Unknown source",
    sourceUrl: r.source_url,
    sources: sourcesOf.get(r.id) ?? [],
    imageUrl: r.image_url,
    excerpt: excerptOf.get(r.id) ?? null,
    summary: r.summary ?? "",
    body: r.body ?? "",
    beat: r.beat && getBeat(r.beat) ? (r.beat as QueueStory["beat"]) : "",
    featured: r.featured,
    slug: r.slug,
    // Formatted here, not in the client, so server and client HTML agree.
    age: formatAge(view === "pending" ? (r.source_published_at ?? r.created_at) : r.published_at, now),
    toolSlugs: toolsOf.get(r.id) ?? [],
  }));

  const tools = allTools
    .map((t) => ({ slug: t.slug, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const mergeTargets: MergeTarget[] =
    view === "pending"
      ? [
          ...rows.map((r) => ({ id: r.id, headline: r.headline })),
          ...(publishedTargets ?? []).map((r) => ({ id: r.id, headline: `Published: ${r.headline}` })),
        ]
      : [];

  const tab = (target: View, label: string) => (
    <Link
      href={target === "pending" ? "/admin/news" : "/admin/news?view=published"}
      aria-current={view === target ? "page" : undefined}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm transition-colors",
        view === target
          ? "border-teal/40 bg-teal/10 text-teal"
          : "border-border text-muted-foreground hover:border-teal/40 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Icon name="ArrowLeft" className="size-3.5" />
              Admin
            </Link>
            <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Operator</p>
            <h1 className="font-display text-4xl font-semibold">News queue</h1>
            <p className="text-sm text-muted-foreground">
              J and K move between stories, P publishes, R rejects. Merge duplicates into one story
              before writing it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/news/sources"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:border-teal/40 hover:text-foreground"
            >
              <Icon name="Globe" className="size-4" />
              Sources
            </Link>
            {view === "pending" ? <FetchNowButton /> : null}
          </div>
        </header>

        <nav className="flex gap-2" aria-label="Queue view">
          {tab("pending", "Pending")}
          {tab("published", "Published")}
        </nav>

        <NewsQueue stories={stories} tools={tools} view={view} mergeTargets={mergeTargets} />
      </div>
    </Container>
  );
}
