import type { PublicStory } from "@/lib/news/stories";
import { CompactStoryList } from "@/components/front-page/compact-story-list";

/** Popular, or Latest until Popular has real traffic (spec §7.3). */
export function StoryRail({ title, stories, now }: { title: "Popular" | "Latest"; stories: PublicStory[]; now: Date }) {
  if (stories.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
      <h2 className="font-mono text-xs tracking-[0.2em] text-teal uppercase">{title}</h2>
      <CompactStoryList stories={stories} now={now} numbered={title === "Popular"} />
    </section>
  );
}
