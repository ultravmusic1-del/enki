import type { BeatSlug } from "@/data/beats";

/** One story as the queue renders it. `age` is computed on the server. */
export type QueueStory = {
  id: string;
  headline: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  excerpt: string | null;
  summary: string;
  body: string;
  beat: BeatSlug | "";
  featured: boolean;
  slug: string | null;
  age: string;
  toolSlugs: string[];
};

export type ToolOption = { slug: string; name: string };
