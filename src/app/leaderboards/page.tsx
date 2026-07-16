import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { LeaderboardsView } from "@/components/leaderboard/leaderboards-view";
import { getLeaderboards } from "@/lib/content";

export const metadata: Metadata = {
  title: "Leaderboards",
  description:
    "The top AI tools on Enki, ranked two ways — by our editors' scores and by the community's ratings. See where the experts and the crowd agree, and where they don't.",
};

export default function LeaderboardsPage() {
  const { editor, user } = getLeaderboards(15);

  return (
    <div className="relative overflow-hidden pt-28 pb-24">
      {/* Atmosphere: a single teal spotlight bleeding from the top. */}
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute inset-x-0 -top-24 h-[560px]"
      />

      <Container className="relative">
        <header className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.22em] text-teal uppercase">
            <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
            The Enki rankings
            <span className="inline-block h-px w-6 bg-teal/60" aria-hidden />
          </span>
          <h1 className="mt-4 text-balance text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Leaderboards
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground">
            The same tools, ranked two ways. Our editors score for capability and
            craft; the community rates from lived experience. Switch between the
            boards to see where the verdict is unanimous and where it splits.
          </p>
        </header>

        <LeaderboardsView editor={editor} user={user} />
      </Container>
    </div>
  );
}
