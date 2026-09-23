import type { MakingStats } from "@/lib/news/issue";

const STEPS = [
  { t: "Read in full.", d: "We read every outlet's coverage of an event, not just the headline." },
  { t: "Merged and checked.", d: "The reporting becomes one story, checked against its sources, with every outlet credited." },
  { t: "What it means for you.", d: "Each story ends with what it means for founders: costs, platform risk, openings and what to watch." },
];

export function HowItsMade({ stats }: { stats: MakingStats }) {
  return (
    <section aria-labelledby="how-its-made" className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">How it&apos;s made</p>
        <h2 id="how-its-made" className="font-display text-3xl font-semibold text-balance uppercase">
          Every story, read across the outlets.
        </h2>
        {stats.stories >= 3 ? (
          <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
            {`${stats.stories} stories · ${stats.outlets} outlets · ${stats.sources} sources merged in the last 7 days`}
          </p>
        ) : null}
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.t} className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 ring-hairline">
            <span aria-hidden="true" className="absolute -bottom-5 right-3 font-display text-8xl leading-none font-semibold text-white/[0.03]">{i + 1}</span>
            <p className="relative font-semibold">{s.t}</p>
            <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
