import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PricingModel } from "@/lib/schemas";

const labels: Record<PricingModel, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  enterprise: "Enterprise",
};

const styles: Record<PricingModel, string> = {
  free: "border-transparent bg-teal/15 text-teal-bright",
  freemium: "border-transparent bg-teal/10 text-teal",
  paid: "border-border bg-secondary text-secondary-foreground",
  enterprise: "border-border bg-muted text-muted-foreground",
};

/** Compact pricing-model chip using the mono "verified" typeface. */
export function PricingBadge({
  model,
  className,
}: {
  model: PricingModel;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[0.65rem] tracking-wide uppercase",
        styles[model],
        className,
      )}
    >
      {labels[model]}
    </Badge>
  );
}
