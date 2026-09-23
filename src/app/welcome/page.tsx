import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { TodaysIssue } from "@/components/home/todays-issue";
import { getHomeIssueData } from "@/lib/news/issue-data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Welcome to Enki Daily",
  robots: { index: false, follow: false },
  alternates: { canonical: "/welcome" },
};

const STEPS = [
  { t: "Check your inbox", d: "If you don't see a confirmation email, check Promotions or Spam." },
  { t: "Add us to your contacts", d: "It keeps Enki Daily out of the spam folder." },
  { t: "Read today's stories", d: "The full articles are already on Enki.", href: "/news" },
];

export default async function WelcomePage() {
  const { issue } = await getHomeIssueData(new Date());
  return (
    <Container className="flex flex-col gap-12 overflow-x-clip pt-28 pb-24">
      <header className="relative mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute -top-10 left-1/2 h-[240px] w-[520px] max-w-[140%] -translate-x-1/2 rounded-full bg-teal/20 blur-[80px]" />
        <p className="relative font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki Daily</p>
        <h1 className="relative font-display text-5xl font-semibold uppercase">You&apos;re in.</h1>
        <p className="relative text-lg text-muted-foreground">Enki Daily arrives every weekday morning.</p>
      </header>
      <ol className="mx-auto grid w-full max-w-4xl gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.t} className="rounded-2xl border border-border bg-card/60 p-5 ring-hairline">
            <p className="font-mono text-[0.65rem] tracking-[0.16em] text-teal uppercase">{`0${i + 1}`}</p>
            {s.href ? (
              <Link href={s.href} className="mt-1.5 block font-semibold hover:text-teal-bright">{s.t} &rarr;</Link>
            ) : (
              <p className="mt-1.5 font-semibold">{s.t}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <TodaysIssue issue={issue} />
    </Container>
  );
}
