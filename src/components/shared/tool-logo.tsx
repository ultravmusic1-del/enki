import Image from "next/image";
import { cn } from "@/lib/utils";
import { Monogram } from "@/components/shared/monogram";

const sizeMap = {
  sm: "size-9 rounded-lg p-1.5",
  md: "size-12 rounded-xl p-2",
  lg: "size-16 rounded-2xl p-2.5",
} as const;

type ToolLogoProps = {
  name: string;
  accent: string;
  /** Path under /public. When absent, a branded monogram is rendered instead. */
  logo?: string;
  size?: keyof typeof sizeMap;
  className?: string;
};

/**
 * A tool's brand mark on a consistent light "chip" so varied logos stay legible
 * and uniform on the dark UI. Falls back to the monogram tile when a tool has
 * no logo.
 */
export function ToolLogo({
  name,
  accent,
  logo,
  size = "md",
  className,
}: ToolLogoProps) {
  if (!logo) {
    return (
      <Monogram name={name} accent={accent} size={size} className={className} />
    );
  }

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden bg-white shadow-sm ring-1 ring-black/10",
        sizeMap[size],
        className,
      )}
    >
      <Image
        src={logo}
        alt={`${name} logo`}
        width={64}
        height={64}
        loading="lazy"
        className="size-full object-contain"
      />
    </span>
  );
}
