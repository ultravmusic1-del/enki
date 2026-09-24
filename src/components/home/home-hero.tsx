import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";

const TRUST = ["Free", "One email, weekday mornings", "Unsubscribe in one click"];

export function HomeHero() {
  return (
    <section id="subscribe" className="relative scroll-mt-28 overflow-hidden rounded-[1.75rem] border border-border px-5 pt-14 pb-12 text-center sm:px-10 sm:pt-16 sm:pb-14">
      <div aria-hidden="true" className="pointer-events-none absolute top-16 left-1/2 h-[360px] w-[640px] max-w-[140%] -translate-x-1/2 rounded-full bg-teal/25 blur-[80px]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_30%,#000_30%,transparent_75%)]"
      />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
        <p className="inline-flex items-center gap-2 rounded-full border border-teal-bright/20 bg-teal/[0.07] py-1.5 pr-3 pl-2">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-teal-bright shadow-[0_0_0_4px_rgba(53,228,236,0.15)]" />
          <span className="font-mono text-[0.6rem] tracking-[0.12em] whitespace-nowrap text-[#cfe9ea] uppercase sm:text-[0.65rem] sm:tracking-[0.18em]">Enki Daily · every weekday morning</span>
        </p>
        <h1 className="mt-6 font-display text-4xl leading-[1.02] font-semibold text-balance uppercase sm:text-6xl">
          AI news for founders.
          <br />
          <span className="bg-[linear-gradient(90deg,#35e4ec,#00adb5_60%,#6fd3d8)] bg-clip-text text-transparent">Five minutes</span> a day.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-[#aeb7c1] sm:text-lg">
          The AI stories that matter to your company, written in full from the best reporting and distilled into what to
          do next. Sharper decisions, the tools worth adopting, and fewer subscriptions you don&apos;t need.
        </p>
        <BeehiivEmbed form="home" className="mt-7 max-w-md" />
        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {TRUST.map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-full bg-teal/15 text-[0.55rem] text-teal-bright">&#10003;</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
