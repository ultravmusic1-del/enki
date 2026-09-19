import * as Sentry from "@sentry/nextjs";
import { getAllTools } from "@/lib/content";
import { createAnonClient } from "@/lib/supabase/anon";
import { ingestAll, type IngestSummary } from "@/lib/news/ingest";
import { createSupabaseIngestStore } from "@/lib/news/ingest-store";

/** One ingestion run, shared by the daily cron and the admin "Fetch now" button. */
export async function runNewsIngest(): Promise<IngestSummary> {
  const secret = process.env.NEWS_INGEST_SECRET;
  if (!secret) throw new Error("NEWS_INGEST_SECRET is not set");

  const tools = await getAllTools();
  return ingestAll({
    store: createSupabaseIngestStore(createAnonClient(), secret),
    tools: tools.map(({ slug, name, aliases }) => ({ slug, name, aliases })),
    report: (error, source) =>
      Sentry.captureException(error, { tags: { news_source: source.name } }),
  });
}
