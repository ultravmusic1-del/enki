import { Icon } from "@/components/shared/icon";
import { SEARCH_QUERY_MAX } from "@/lib/news/search";
import { cn } from "@/lib/utils";

/** A plain GET form to /news/search: works without JavaScript and is shareable as a URL. */
export function NewsSearchForm({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  return (
    <form action="/news/search" method="get" role="search" className={cn("flex min-w-0 items-center gap-2", className)}>
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-input bg-background/60 px-3 text-sm focus-within:border-teal/50">
        <Icon name="Search" className="size-4 shrink-0 text-teal" />
        <span className="sr-only">Search the news</span>
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          maxLength={SEARCH_QUERY_MAX}
          placeholder="Search past stories"
          className="min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground focus:outline-none"
        />
      </label>
      <button
        type="submit"
        className="h-10 shrink-0 rounded-xl border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground"
      >
        Search
      </button>
    </form>
  );
}
