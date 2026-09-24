const BENEFITS = [
  { k: "01 · Build better", t: "Insight you can act on", d: "Every story ends with what it means for your company: costs, risks and openings." },
  { k: "02 · Stay current", t: "The tools worth knowing", d: "New models and products, judged on whether they deserve a place in your stack." },
  { k: "03 · Spend less", t: "Cut the tools that don't earn it", d: "Know when a cheaper model or a feature you already pay for does the job." },
];

/** The three promises, as their own band below the hero card. */
export function HomeBenefits() {
  return (
    <section aria-labelledby="home-benefits" className="relative">
      <h2 id="home-benefits" className="sr-only">What Enki Daily gives you</h2>
      <ul className="mx-auto grid max-w-5xl border-y border-border text-left sm:grid-cols-3">
        {BENEFITS.map((b, i) => (
          <li
            key={b.k}
            className={
              i > 0
                ? "border-t border-border px-1 py-6 sm:border-t-0 sm:border-l sm:px-6 lg:px-8"
                : "px-1 py-6 sm:px-6 lg:px-8"
            }
          >
            <p className="font-mono text-[0.65rem] tracking-[0.16em] text-teal uppercase">{b.k}</p>
            <p className="mt-2 text-base font-semibold">{b.t}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.d}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
