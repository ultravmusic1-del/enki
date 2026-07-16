// Standardized tool-screenshot capture.
//
// Drives headless Chromium at a fixed 1280x800 viewport (exact 16:10, matching
// the detail-page carousel) and saves one PNG per shot to
// public/screenshots/<slug>/<name>.png. Fixed viewport => every image ships at
// identical pixel dimensions, so the carousel stays visually consistent.
//
// Cookie/consent overlays are removed from the DOM before capture (we neither
// accept nor reject — the banner simply isn't rendered into the marketing shot).
//
// Usage:
//   node scripts/capture-screenshots.mjs            # all tools in the manifest
//   node scripts/capture-screenshots.mjs jasper     # only matching slugs

import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "public", "screenshots");

const VIEWPORT = { width: 1280, height: 800 };

// Per-tool capture plan. `scrollY` positions each shot down the page; tune per
// site after a first look. `name` becomes the file name and maps to a data entry.
// Default three-section plan for a scrollable marketing site.
const TRIPLE = [
  { name: "hero", scrollY: 0 },
  { name: "features", scrollY: 1100 },
  { name: "detail", scrollY: 2200 },
];

const MANIFEST = [
  { slug: "jasper", url: "https://www.jasper.ai", shots: [
    { name: "hero", scrollY: 0 },
    { name: "features", scrollY: 1100 },
    { name: "workflow", scrollY: 2200 },
  ] },
  // App-first: apex redirects to the logged-out app (non-scrolling SPA).
  { slug: "perplexity", url: "https://www.perplexity.ai", shots: [{ name: "app", scrollY: 0 }] },

  { slug: "copy-ai", url: "https://www.copy.ai", shots: TRIPLE },
  { slug: "sudowrite", url: "https://www.sudowrite.com", shots: TRIPLE },
  { slug: "grammarly", url: "https://www.grammarly.com", shots: TRIPLE },
  { slug: "midjourney", url: "https://www.midjourney.com", shots: TRIPLE },
  { slug: "dall-e-3", url: "https://openai.com/index/dall-e-3/", shots: TRIPLE },
  { slug: "stable-diffusion", url: "https://stability.ai", shots: TRIPLE },
  { slug: "adobe-firefly", url: "https://www.adobe.com/products/firefly.html", shots: TRIPLE },
  { slug: "github-copilot", url: "https://github.com/features/copilot", shots: TRIPLE },
  { slug: "cursor", url: "https://www.cursor.com", shots: TRIPLE },
  { slug: "windsurf", url: "https://windsurf.com", shots: TRIPLE },
  { slug: "replit-agent", url: "https://replit.com", shots: TRIPLE },
  { slug: "notion-ai", url: "https://www.notion.so/product/ai", shots: TRIPLE },
  { slug: "mem", url: "https://get.mem.ai", shots: TRIPLE },
  { slug: "motion", url: "https://www.usemotion.com", shots: TRIPLE },
  { slug: "runway", url: "https://runwayml.com", shots: TRIPLE },
  { slug: "pika", url: "https://pika.art", shots: TRIPLE },
  { slug: "synthesia", url: "https://www.synthesia.io", shots: TRIPLE },
  { slug: "elevenlabs", url: "https://elevenlabs.io", shots: TRIPLE },
  { slug: "murf", url: "https://murf.ai", shots: TRIPLE },
  { slug: "suno", url: "https://suno.com", shots: TRIPLE },
  { slug: "elicit", url: "https://elicit.com", shots: TRIPLE },
  { slug: "consensus", url: "https://consensus.app", shots: TRIPLE },
  { slug: "surfer-seo", url: "https://surferseo.com", shots: TRIPLE },
  { slug: "adcreative-ai", url: "https://www.adcreative.ai", shots: TRIPLE },
  { slug: "clay", url: "https://www.clay.com", shots: TRIPLE },
];

// Best-effort removal of fixed overlays (cookie bars, sticky nav, chat widgets)
// so they don't bleed into every shot. Runs in the page context.
const STRIP_OVERLAYS = () => {
  const KILL = [
    "[id*='cookie' i]", "[class*='cookie' i]",
    "[id*='consent' i]", "[class*='consent' i]",
    "[id*='gdpr' i]", "[class*='gdpr' i]",
    "[aria-label*='cookie' i]", "[class*='cookie-banner' i]",
    "#onetrust-banner-sdk", ".ot-sdk-container",
    "[class*='intercom' i]", "[id*='intercom' i]",
    "[class*='drift' i]", "[class*='chat-widget' i]",
  ];
  for (const sel of KILL) {
    document.querySelectorAll(sel).forEach((el) => {
      const pos = getComputedStyle(el).position;
      // Only nuke floating overlays, not inline page content that happens to match.
      if (pos === "fixed" || pos === "sticky" || el.getBoundingClientRect().height > 200) {
        el.remove();
      }
    });
  }

  // Generic corner-widget killer: any position:fixed element anchored to a
  // viewport corner is a chat / support / cookie bubble, never page content.
  // Pierces shadow roots, since chat widgets (Intercom, Drift, custom) render
  // inside a shadow DOM that querySelectorAll can't otherwise reach.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const walk = (root) => {
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) walk(el.shadowRoot);
      let pos;
      try { pos = getComputedStyle(el).position; } catch { return; }
      if (pos !== "fixed") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.width > vw * 0.6 || r.height > vh * 0.7) return;
      const nearBottom = r.bottom > vh - 40;
      const nearCorner = r.left < 40 || r.right > vw - 40;
      if (nearBottom && nearCorner) el.remove();
    });
  };
  walk(document);
  // Also drop shadow hosts pinned to a bottom corner (the fixed positioning may
  // live inside the shadow tree while the host itself measures the widget box).
  document.querySelectorAll("body > *").forEach((el) => {
    if (!el.shadowRoot) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.height > vh * 0.7) return;
    if (r.bottom > vh - 40 && (r.left < 40 || r.right > vw - 40)) el.remove();
  });

  document.documentElement.style.scrollBehavior = "auto";
  document.body.style.overflow = "auto";
};

async function captureTool(context, tool) {
  const page = await context.newPage();
  const dir = join(OUT, tool.slug);
  await mkdir(dir, { recursive: true });

  console.log(`\n[${tool.slug}] ${tool.url}`);
  try {
    await page.goto(tool.url, { waitUntil: "networkidle", timeout: 45000 });
  } catch {
    // networkidle can hang on sites with long-poll connections; fall back.
    await page.goto(tool.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  await page.waitForTimeout(1500);
  await page.evaluate(STRIP_OVERLAYS);
  await page.waitForTimeout(500);

  for (const shot of tool.shots) {
    await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
    await page.waitForTimeout(900); // let lazy content / animations settle
    await page.evaluate(STRIP_OVERLAYS);
    const file = join(dir, `${shot.name}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, ...VIEWPORT } });
    console.log(`  ✓ ${shot.name}.png`);
  }
  await page.close();
}

async function main() {
  const only = process.argv.slice(2);
  const tools = only.length
    ? MANIFEST.filter((t) => only.includes(t.slug))
    : MANIFEST;

  if (!tools.length) {
    console.error("No matching tools in manifest for:", only.join(", "));
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  });

  // Block chat / support / consent widget hosts so they never render into a shot.
  const BLOCK = [
    "intercom", "intercomcdn", "drift.com", "driftt", "crisp.chat",
    "tidio", "tawk.to", "hubspot", "hs-scripts", "zendesk", "zdassets",
    "livechat", "onetrust", "cookiebot", "cookielaw", "usercentrics",
  ];
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (BLOCK.some((h) => url.includes(h))) return route.abort();
    return route.continue();
  });

  for (const tool of tools) {
    try {
      await captureTool(context, tool);
    } catch (err) {
      console.error(`  ✗ ${tool.slug} failed:`, err.message);
    }
  }

  await browser.close();
  console.log("\nDone.");
}

main();
