import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { formatAge } from "@/lib/news/format-age";
import { safeExternalHref } from "@/lib/safe-url";
import { Container } from "@/components/shared/container";
import { Icon } from "@/components/shared/icon";
import { SourceForm } from "@/app/admin/news/sources/source-form";
import { SourceToggle } from "@/app/admin/news/sources/source-toggle";

export const metadata: Metadata = {
  title: "News sources",
  robots: { index: false, follow: false },
};

export default async function NewsSourcesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("news_sources")
    .select("id, name, feed_url, site_url, active, last_fetched_at, last_error")
    .order("name");
  const now = new Date();

  return (
    <Container className="pt-28 pb-20">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <Link href="/admin/news" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="ArrowLeft" className="size-3.5" />
            News queue
          </Link>
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Operator</p>
          <h1 className="font-display text-4xl font-semibold">News sources</h1>
          <p className="text-sm text-muted-foreground">
            Feeds fetched every morning and whenever you press Fetch now.
          </p>
        </header>

        <SourceForm />

        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/60 ring-hairline">
          {(sources ?? []).map((source) => (
            <li key={source.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <a href={safeExternalHref(source.site_url)} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-teal">
                  {source.name}
                </a>
                <span className="truncate font-mono text-xs text-muted-foreground">{source.feed_url}</span>
                <span className="text-xs text-muted-foreground">
                  Last fetched {formatAge(source.last_fetched_at, now)}
                  {source.last_error ? (
                    <span className="text-destructive"> · {source.last_error}</span>
                  ) : null}
                </span>
              </div>
              <SourceToggle id={source.id} active={source.active} />
            </li>
          ))}
          {(sources ?? []).length === 0 ? (
            <li className="p-5 text-sm text-muted-foreground">Add a feed to start collecting stories.</li>
          ) : null}
        </ul>
      </div>
    </Container>
  );
}
