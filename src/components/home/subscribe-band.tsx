import { BeehiivEmbed } from "@/components/newsletter/beehiiv-embed";
import { cn } from "@/lib/utils";

export function SubscribeBand({ variant, id }: { variant: "compact" | "large"; id?: string }) {
  const large = variant === "large";
  return (
    <section
      id={id}
      data-subscribe-band
      className={cn(
        "relative overflow-hidden rounded-[1.5rem] border border-border text-center",
        large ? "px-5 py-16 sm:px-10 sm:py-20" : "px-5 py-10 sm:px-10",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-teal/20 blur-[80px]",
          large ? "top-1/2 h-[320px] w-[620px] max-w-[140%] -translate-y-1/2" : "-top-24 h-[220px] w-[520px] max-w-[140%]",
        )}
      />
      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
        {large ? (
          <>
            <h2 className="font-display text-3xl font-semibold text-balance uppercase sm:text-4xl">
              The brief to read before the day starts.
            </h2>
            <p className="text-muted-foreground">Free, every weekday morning.</p>
          </>
        ) : (
          <h2 className="text-lg font-semibold text-balance">Get tomorrow&apos;s brief before your first meeting.</h2>
        )}
        <BeehiivEmbed form="home" lazy className="max-w-md" />
      </div>
    </section>
  );
}
