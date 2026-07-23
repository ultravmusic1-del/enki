import Link from "next/link";

/**
 * FTC-friendly affiliate disclosure. Shown near outbound links; the full policy
 * lives on the privacy page (#affiliate).
 */
export function AffiliateDisclosure({ className }: { className?: string }) {
  return (
    <p className={className}>
      <Link
        href="/privacy#affiliate"
        className="hover:text-foreground hover:underline"
      >
        We may earn a commission
      </Link>{" "}
      if you sign up through our links — it never affects our rating.
    </p>
  );
}
