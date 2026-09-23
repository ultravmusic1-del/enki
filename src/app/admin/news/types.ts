import type { BeatSlug } from "@/data/beats";

/** Which slice of the queue the admin is looking at. */
export type QueueView = "pending" | "published" | "rejected";

/** A duplicate row merged into a story as one of its sources. */
export type QueueSource = { id: string; sourceName: string; sourceUrl: string };

/** A story another row can be merged into. */
export type MergeTarget = { id: string; headline: string };

/** One story as the queue renders it. `age` is computed on the server. */
export type QueueStory = {
  id: string;
  headline: string;
  sourceName: string;
  sourceUrl: string;
  sources: QueueSource[];
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
