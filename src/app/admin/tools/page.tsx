import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllTools } from "@/lib/content";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";

export const metadata: Metadata = {
  title: "Manage tools",
  robots: { index: false, follow: false },
};

export default async function AdminToolsPage() {
  await requireAdmin();

  const tools = await getAllTools();
  const supabase = await createClient();
  const { data: dbRows } = await supabase.from("tools").select("slug, published");
  const dbBySlug = new Map((dbRows ?? []).map((r) => [r.slug, r]));

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
              Operator
            </p>
            <h1 className="font-display text-4xl font-semibold">Manage tools</h1>
            <p className="text-sm text-muted-foreground">
              Edits write a database override on top of the git-versioned seed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground"
            >
              <Icon name="ArrowLeft" className="size-4" />
              Admin
            </Link>
            <Link
              href="/admin/tools/new"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-teal px-5 text-sm font-semibold text-[#04171a] hover:bg-teal-bright"
            >
              <Icon name="Plus" className="size-4" />
              New tool
            </Link>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-border ring-hairline">
          {tools.map((t) => {
            const db = dbBySlug.get(t.slug);
            return (
              <Link
                key={t.slug}
                href={`/admin/tools/${t.slug}`}
                className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
              >
                <span className="truncate text-sm font-medium">{t.name}</span>
                <span className="flex shrink-0 items-center gap-2 font-mono text-[0.65rem] tracking-wide uppercase">
                  <span
                    className={
                      db ? "text-teal" : "text-muted-foreground/60"
                    }
                  >
                    {db ? "DB" : "seed"}
                  </span>
                  {db && !db.published && (
                    <span className="text-amber-300">draft</span>
                  )}
                  <Icon
                    name="ChevronRight"
                    className="size-3.5 text-muted-foreground"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </Container>
  );
}
