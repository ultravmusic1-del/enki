import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { IngestStore } from "@/lib/news/ingest";

/**
 * IngestStore over the secret-gated ingest RPCs. Used with the anon client:
 * the secret, not a privileged key, is what authorises the writes, and the
 * RPCs can only ever create *pending* stories.
 */
export function createSupabaseIngestStore(
  client: SupabaseClient<Database>,
  secret: string,
): IngestStore {
  return {
    async listSources() {
      const { data, error } = await client.rpc("ingest_sources", { secret });
      if (error) throw new Error(`ingest_sources failed: ${error.message}`);
      return (data ?? []).map((s) => ({ id: s.id, name: s.name, feedUrl: s.feed_url }));
    },
    async insertStory(story) {
      const { data, error } = await client.rpc("ingest_story", {
        secret,
        p_source_id: story.sourceId,
        p_source_url: story.sourceUrl,
        p_headline: story.headline,
        p_excerpt: story.excerpt,
        p_image_url: story.imageUrl,
        p_source_published_at: story.sourcePublishedAt,
        p_tool_slugs: story.toolSlugs,
      });
      if (error) throw new Error(`ingest_story failed: ${error.message}`);
      return data === true;
    },
    async touchSource(id, lastError) {
      const { error } = await client.rpc("touch_news_source", {
        secret,
        p_source_id: id,
        p_error: lastError,
      });
      if (error) throw new Error(`touch_news_source failed: ${error.message}`);
    },
  };
}
