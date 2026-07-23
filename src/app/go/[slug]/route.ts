import { NextResponse, type NextRequest } from "next/server";
import { getToolBySlug } from "@/lib/content";
import { resolveOutboundTarget } from "@/lib/outbound";
import { createAnonClient } from "@/lib/supabase/anon";
import { siteConfig } from "@/lib/site";

/**
 * Tracked outbound redirect. Records an anonymous click (tool + source path,
 * no PII) then 302s to the tool's affiliate URL or website. Unknown slugs fall
 * back to the directory so a link never dead-ends.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return NextResponse.redirect(new URL("/tools", siteConfig.url));
  }

  const { url } = resolveOutboundTarget(tool);

  // Same-origin source path only (never the full external referrer).
  let path: string | null = null;
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.origin === new URL(request.url).origin) path = u.pathname;
    } catch {
      path = null;
    }
  }

  try {
    await createAnonClient()
      .from("outbound_clicks")
      .insert({ tool_slug: slug, path });
  } catch {
    // Never let logging failure block the user's navigation.
  }

  return NextResponse.redirect(url);
}
