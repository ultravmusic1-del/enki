import type { Metadata } from "next";
import { Container } from "@/components/shared/container";
import { HomeHero } from "@/components/home/home-hero";
import { HomeBenefits } from "@/components/home/home-benefits";
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
import { pageMetadata } from "@/lib/metadata";

// Publishing a story revalidates "/" (admin actions), so today's issue stays current.
export const revalidate = 300;

const TITLE = "Enki Daily: AI news for founders, five minutes a day";
const DESCRIPTION = "The AI stories that matter to your company, with what to do next. Free, every weekday morning.";

export const metadata: Metadata = {
  ...pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/", socialTitle: TITLE }),
  title: { absolute: TITLE },
};

export default async function Home() {
  const [{ issue, stats }, featured] = await Promise.all([getHomeIssueData(new Date()), getFeaturedTools()]);
  const tools = featured.filter((t) => !t.sponsored).slice(0, 6);

  return (
    <>
      <Container className="flex flex-col gap-20 pt-28 pb-24 sm:gap-24">
        <div className="flex flex-col gap-12 sm:gap-16">
          <HomeHero />
          <HomeBenefits />
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
