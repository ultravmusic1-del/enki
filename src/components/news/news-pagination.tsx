import Link from "next/link";

const linkClass =
  "rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-teal/40 hover:text-foreground";

/** Newer/Older links. Page 1 is /news; later pages are /news/page/N. */
export function NewsPagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (p: number) => (p === 1 ? "/news" : `/news/page/${p}`);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          Newer stories
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          Older stories
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
