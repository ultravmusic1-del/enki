import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllTools } from "@/lib/content";
import { STALE_AFTER_DAYS, toolsNeedingRevet } from "@/lib/freshness";
import { Container } from "@/components/shared/container";
import { ModerationActions } from "@/app/admin/moderation-actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await requireAdmin();

  const supabase = await createClient();
  const allTools = getAllTools();
  const nameBySlug = new Map(allTools.map((t) => [t.slug, t.name]));
  const revet = toolsNeedingRevet(allTools, new Date());

  const [{ data: stats }, { count: reviewCount }, { data: reviews }] =
    await Promise.all([
      supabase.rpc("admin_click_stats", { days: 30 }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase
        .from("reviews")
        .select("id, tool_slug, rating, title, body, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const clickRows = stats ?? [];
  const totalClicks = clickRows.reduce((sum, r) => sum + Number(r.clicks), 0);

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Operator
          </p>
          <h1 className="font-display text-4xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Outbound demand and community moderation. Editorial content is still
            managed in <code className="font-mono">src/data</code>.
          </p>
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border ring-hairline md:grid-cols-3">
          <Kpi label="Tools" value={String(nameBySlug.size)} />
          <Kpi label="Reviews" value={String(reviewCount ?? 0)} />
          <Kpi label="Outbound clicks (30d)" value={String(totalClicks)} />
        </section>

        {/* Click leaderboard */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">
            Outbound demand · last 30 days
          </h2>
          {clickRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outbound clicks recorded yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border ring-hairline">
              {clickRows.map((row, i) => (
                <div
                  key={row.tool_slug}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm">
                      {nameBySlug.get(row.tool_slug) ?? row.tool_slug}
                    </span>
                  </span>
                  <span className="font-mono text-sm text-teal tabular-nums">
                    {row.clicks}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Re-vet queue */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold">
              Needs re-vetting
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              {revet.length} of {allTools.length} · stale after{" "}
              {STALE_AFTER_DAYS} days
            </p>
          </div>
          {revet.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every listing has been vetted recently.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border ring-hairline">
              {revet.slice(0, 12).map(({ tool, status }) => (
                <div
                  key={tool.slug}
                  className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="truncate text-sm">{tool.name}</span>
                  <span
                    className={
                      status.state === "never"
                        ? "font-mono text-xs text-destructive"
                        : "font-mono text-xs text-muted-foreground"
                    }
                  >
                    {status.state === "never"
                      ? "never vetted"
                      : `${status.daysAgo}d ago`}
                  </span>
                </div>
              ))}
              {revet.length > 12 && (
                <div className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  +{revet.length - 12} more
                </div>
              )}
            </div>
          )}
        </section>

        {/* Moderation */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">
            Community reviews
          </h2>
          {!reviews || reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No community reviews yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 ring-hairline"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {nameBySlug.get(r.tool_slug) ?? r.tool_slug}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {r.rating}★
                      </span>
                    </span>
                    <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                      {r.status}
                    </span>
                  </div>
                  {r.title && (
                    <p className="font-display text-base font-semibold">
                      {r.title}
                    </p>
                  )}
                  {r.body && (
                    <p className="text-sm text-pretty text-muted-foreground">
                      {r.body}
                    </p>
                  )}
                  <ModerationActions id={r.id} status={r.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Container>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-card px-4 py-6 text-center">
      <span className="font-display text-3xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="font-mono text-[0.7rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
