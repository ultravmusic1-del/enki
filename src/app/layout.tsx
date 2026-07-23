import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SavedToolsProvider } from "@/components/saved/saved-tools";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { JsonLd } from "@/components/seo/json-ld";
import { siteJsonLd } from "@/lib/structured-data";
import { SiteHeader } from "@/components/layout/site-header";
import { CompareTray } from "@/components/compare/compare-tray";
import { SiteFooter } from "@/components/layout/site-footer";
import { fontVariables } from "@/lib/fonts";
import { siteConfig } from "@/lib/site";
import { getSearchDocs, getAllTools } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} · ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "AI tools",
    "AI directory",
    "AI tool reviews",
    "best AI software",
    "AI tool comparison",
    "Enki",
  ],
  authors: [{ name: siteConfig.name }],
  openGraph: {
    type: "website",
    url: siteConfig.url,
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#16191d",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const searchDocs = getSearchDocs();
  const compareTools = getAllTools().map((t) => ({
    slug: t.slug,
    name: t.name,
    logo: t.logo,
    accent: t.accent,
  }));

  return (
    <html lang="en" className={`dark ${fontVariables} h-full antialiased`}>
      <body className="relative min-h-full">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <JsonLd data={siteJsonLd()} />
        <div aria-hidden className="grain" />
        <AuthProvider>
          <SavedToolsProvider>
            <CommandMenuProvider docs={searchDocs}>
              <SiteHeader />
              <main
                id="main-content"
                tabIndex={-1}
                className="relative z-10 flex min-h-screen flex-col"
              >
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </main>
            </CommandMenuProvider>
            <CompareTray tools={compareTools} />
          </SavedToolsProvider>
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{ className: "font-sans" }}
        />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
