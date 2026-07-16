"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Icon } from "@/components/shared/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Desktop account control: "Log in" when signed out, an avatar menu otherwise. */
export function AccountMenu({ className }: { className?: string }) {
  const { user, displayName, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <span
        aria-hidden
        className={cn(
          "hidden size-8 animate-pulse rounded-full bg-muted/50 lg:block",
          className,
        )}
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "hidden rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex",
          className,
        )}
      >
        Log in
      </Link>
    );
  }

  const initial = (displayName ?? "?").charAt(0).toUpperCase();

  const onSignOut = async () => {
    await signOut();
    toast("Signed out");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            "hidden size-8 place-items-center rounded-full bg-teal/15 font-display text-sm font-semibold text-teal-bright ring-1 ring-teal/30 transition-transform hover:-translate-y-px lg:grid",
            className,
          )}
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">
          {displayName}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/saved" className="gap-2">
            <Icon name="Bookmark" className="size-4" />
            Saved tools
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} className="gap-2">
          <Icon name="ArrowRight" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
