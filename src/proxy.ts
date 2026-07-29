import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on every route except static assets, image/model files, and the
    // Sentry tunnel. The tunnel carries error envelopes to Sentry: running a
    // Supabase session refresh on each one would add a round trip to every
    // reported error, and an error thrown in that refresh would be reported
    // through the same path.
    "/((?!sentry-tunnel|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|ico)$).*)",
  ],
};
