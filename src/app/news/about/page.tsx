import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/shared/container";

export const metadata: Metadata = {
  title: "How Enki covers news",
  description: "Where Enki's AI news comes from, and how tool links on stories work.",
  alternates: { canonical: "/news/about" },
};

export default function NewsAboutPage() {
  return (
    <Container className="pt-28 pb-20">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 text-pretty text-muted-foreground">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Enki news</p>
          <h1 className="font-display text-4xl font-semibold text-foreground">How Enki covers news</h1>
        </header>
        <p>
          Enki follows a set of AI news sources every day and picks the stories worth your time.
          Each story links to the publisher that reported it. The headline and the reporting
          belong to them.
        </p>
        <p>
          Every summary and take on Enki is written from the linked source. For the complete
          reporting, read the full story at the publisher.
        </p>
        <p>
          Some stories list the AI tools they mention. Those links may earn Enki a commission if
          you sign up, and that never influences which stories we run or how we summarise them.
          More in our{" "}
          <Link href="/privacy#affiliate" className="text-teal hover:underline">
            affiliate policy
          </Link>
          .
        </p>
        <p>
          Spotted a mistake? Email{" "}
          <a className="text-teal hover:underline" href="mailto:enkidirectory@gmail.com">
            enkidirectory@gmail.com
          </a>{" "}
          and we will fix it.
        </p>
        <p>
          <Link href="/news" className="text-teal hover:underline">
            Back to the news
          </Link>
        </p>
      </article>
    </Container>
  );
}
