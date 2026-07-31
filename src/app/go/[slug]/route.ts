import { NextResponse, after, type NextRequest } from "next/server";
import { getToolBySlug } from "@/lib/content";
import { resolveOutboundTarget } from "@/lib/outbound";
import { isHttpUrl } from "@/lib/safe-url";
import { createAnonClient } from "@/lib/supabase/anon";
import { siteConfig } from "@/lib/site";
import { allowWrite } from "@/lib/rate-limit";

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
  const tool = await getToolBySlug(slug);

  if (!tool) {
    return NextResponse.redirect(new URL("/tools", siteConfig.url));
  }

  const { url } = resolveOutboundTarget(tool);

  // A stored non-http target (mobile deep link, javascript:, data:) must never
  // become a Location header. Fall back to the directory rather than 502-ing.
  if (!isHttpUrl(url)) {
    console.error("[enki] refusing non-http outbound target", { slug });
    return NextResponse.redirect(new URL("/tools", siteConfig.url));
  }

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

  // Logging runs AFTER the response is sent, so neither the rate-limit probe
  // nor the Supabase insert sits on the affiliate critical path. Both are
  // network round-trips with no AbortSignal and this project sets no
  // maxDuration, so awaiting them inline meant a wedged call could turn a
  // redirect into a 504 and lose the click. `after()` makes "the redirect is
  // always reached" structural rather than something a future edit must
  // preserve by hand.
  //
  // The limit gates the LOGGING only, never the redirect: a rate-limited click
  // still travels, it just stops inflating the affiliate click count. Headers
  // are snapshotted here because `request` is not guaranteed readable once the
  // response has been flushed.
  const requestHeaders = Object.fromEntries(request.headers.entries());

  after(async () => {
    try {
      if (await allowWrite("outbound", { headers: requestHeaders })) {
        await createAnonClient()
          .from("outbound_clicks")
          .insert({ tool_slug: slug, path });
      }
    } catch {
      // Never let logging failure surface; the visitor has already been sent on.
    }
  });

  return NextResponse.redirect(url);
}
