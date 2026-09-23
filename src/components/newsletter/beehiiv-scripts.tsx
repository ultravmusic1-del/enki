"use client";

import Script from "next/script";
import { BEEHIIV_ATTRIBUTION_SCRIPT, BEEHIIV_EMBED_SCRIPT, NEWSLETTER } from "@/lib/newsletter";

/** beehiiv's loader and UTM attribution scripts. Render once on a page with an embed. */
export function BeehiivScripts() {
  const any = Object.values(NEWSLETTER.forms).some((f) => f.src);
  if (!any) return null;
  return (
    <>
      <Script src={BEEHIIV_EMBED_SCRIPT} strategy="afterInteractive" />
      <Script src={BEEHIIV_ATTRIBUTION_SCRIPT} strategy="afterInteractive" />
    </>
  );
}
