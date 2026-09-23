const FAQ = [
  { q: "Is Enki Daily free?", a: "Yes, Enki Daily is free." },
  { q: "When does it arrive?", a: "Every weekday morning." },
  { q: "How long is it?", a: "About five minutes. Each story is short, and the full article is one click away on Enki." },
  { q: "Will you share my email?", a: "No. Your address is used only to send Enki Daily. The list is managed by our email provider, beehiiv, and is never sold." },
  { q: "How do I unsubscribe?", a: "Every email has a one-click unsubscribe link at the bottom." },
];

export function HomeFaq() {
  return (
    <section aria-labelledby="home-faq" className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h2 id="home-faq" className="text-center font-display text-3xl font-semibold uppercase">Before you subscribe</h2>
      <div className="divide-y divide-border rounded-2xl border border-border bg-card/60 ring-hairline">
        {FAQ.map(({ q, a }) => (
          <details key={q} className="group px-5 py-4 sm:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              {q}
              <span aria-hidden="true" className="text-teal transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
