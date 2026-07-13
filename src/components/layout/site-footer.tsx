"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { siteConfig } from "@/lib/site";
import { newsletterSchema, type NewsletterValues } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/shared/icon";
import { cn } from "@/lib/utils";

const exploreLinks = [
  { title: "All tools", href: "/tools" },
  { title: "Categories", href: "/categories" },
  { title: "How we vet", href: "/#how-we-vet" },
];

const socialLinks = [
  { name: "Twitter", href: siteConfig.social.twitter, icon: "ArrowUpRight" },
  { name: "GitHub", href: siteConfig.social.github, icon: "ArrowUpRight" },
  { name: "LinkedIn", href: siteConfig.social.linkedin, icon: "ArrowUpRight" },
];

export function SiteFooter() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: NewsletterValues) => {
    // Client-only demo: no network call. Confirm with a toast.
    toast.success("You're on the list", {
      description: `We'll send the best new AI tools to ${values.email}.`,
    });
    reset();
  };

  return (
    <footer className="relative mt-24 border-t border-border">
      <div className="spotlight pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60" />
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1.4fr]">
          {/* Brand + blurb */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <span
                className="emblem size-7"
                style={{ color: "var(--brand-teal)" }}
                aria-hidden
              />
              <span className="font-display text-xl font-semibold">Enki</span>
            </Link>
            <p className="max-w-xs text-sm text-pretty text-muted-foreground">
              The oracle for AI tools. Curated, human-vetted, and built to help
              you trust what you adopt.
            </p>
            <p className="font-mono text-xs tracking-wide text-muted-foreground/70 uppercase">
              {siteConfig.tagline}
            </p>
          </div>

          {/* Explore links */}
          <nav aria-label="Footer" className="flex flex-col gap-3">
            <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Explore
            </span>
            {exploreLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="w-fit text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.title}
              </Link>
            ))}
          </nav>

          {/* Newsletter */}
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              The Tablet — our newsletter
            </span>
            <p className="text-sm text-muted-foreground">
              A monthly dispatch of the most worthwhile new AI tools. No noise.
            </p>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-2"
              noValidate
            >
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  aria-label="Email address"
                  aria-invalid={!!errors.email}
                  className="h-9 flex-1"
                  {...register("email")}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="shrink-0 gap-1.5"
                >
                  Subscribe
                  <Icon name="ArrowRight" className="size-3.5" />
                </Button>
              </div>
              {errors.email && (
                <span className="text-xs text-destructive">
                  {errors.email.message}
                </span>
              )}
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {2026} Enki. Wisdom for the age of AI.
          </p>
          <div className="flex items-center gap-2">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground",
                  "transition-colors hover:border-teal/40 hover:text-foreground",
                )}
              >
                {social.name}
                <Icon name={social.icon} className="size-3" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
