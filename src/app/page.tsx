import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { HomeHero } from "@/components/home/home-hero";
import { TodaysIssue } from "@/components/home/todays-issue";
import { HowItsMade } from "@/components/home/how-its-made";
import { TakeawayAnatomy } from "@/components/home/takeaway-anatomy";
import { SubscribeBand } from "@/components/home/subscribe-band";
import { TrendingTools } from "@/components/home/trending-tools";
import { HomeFaq } from "@/components/home/home-faq";
import { StickySubscribeBar } from "@/components/home/sticky-subscribe-bar";
import { BeehiivScripts } from "@/components/newsletter/beehiiv-scripts";
import { getHomeIssueData } from "@/lib/news/issue-data";
import { getFeaturedTools } from "@/lib/content";

// Publishing a story revalidates "/" (admin actions), so today's issue stays current.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Enki Daily: AI news for founders, five minutes a day" },
  description: "The AI stories that matter to your company, with what to do next. Free, every weekday morning.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [{ issue, stats }, featured] = await Promise.all([getHomeIssueData(new Date()), getFeaturedTools()]);
  const tools = featured.filter((t) => !t.sponsored).slice(0, 6);

  return (
    <>
      <Container className="flex flex-col gap-20 pt-28 pb-24 sm:gap-24">
        <div className="flex flex-col gap-10">
          <HomeHero />
          <TodaysIssue issue={issue} />
        </div>
        <HowItsMade stats={stats} />
        <TakeawayAnatomy issue={issue} />
        <SubscribeBand variant="compact" />
        <TrendingTools tools={tools} />
        <HomeFaq />
        <SubscribeBand variant="large" />
      </Container>
      <StickySubscribeBar />
      <BeehiivScripts />
    </>
  );
}
