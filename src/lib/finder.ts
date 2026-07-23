import type { Tool } from "@/lib/schemas";

/* =========================================================================
   "Ask the Oracle" — guided finder recommendation engine.

   Pure and deterministic: given the user's answers, score every tool and
   return a reasoned shortlist. No network, no LLM — quality (editor score,
   community rating) is always part of the score so the ranking is sensible
   even before any question is answered. Category dominates; budget and
   platform nudge. Off-target tools are penalized but stay eligible as
   fillers, so the shortlist is never empty.
   ========================================================================= */

export type BudgetPref = "free" | "trial" | "pay";
export type PlatformPref = "web" | "mac" | "windows" | "mobile" | "api" | "any";

export type FinderAnswers = {
  /** Category slug, or undefined for "any use-case". */
  category?: string;
  budget?: BudgetPref;
  platform?: PlatformPref;
};

export type FinderResult = {
  tool: Tool;
  score: number;
  /** Up to 3 short, human reasons, match-signals first, quality last. */
  reasons: string[];
};

/** Which stored `platforms` values satisfy each platform preference. */
const PLATFORM_MATCH: Record<Exclude<PlatformPref, "any">, string[]> = {
  web: ["Web", "Browser extension"],
  mac: ["macOS"],
  windows: ["Windows"],
  mobile: ["iOS", "Android"],
  api: ["API", "VS Code", "JetBrains", "CLI"],
};

export const PLATFORM_LABEL: Record<Exclude<PlatformPref, "any">, string> = {
  web: "the web",
  mac: "macOS",
  windows: "Windows",
  mobile: "mobile",
  api: "your dev stack",
};

function scoreOne(
  tool: Tool,
  answers: FinderAnswers,
  categoryName: Map<string, string>,
): FinderResult {
  let score = 0;
  const reasons: string[] = [];

  // Quality baseline — always present so ranking is sensible with no answers.
  score += tool.editorScore * 2; // 0..20
  score += tool.rating * 2; //     2..10
  if (tool.featured) score += 2;

  // Use-case (category) — the dominant signal.
  if (answers.category) {
    if (tool.categorySlug === answers.category) {
      score += 100;
      const name = categoryName.get(tool.categorySlug);
      if (name) reasons.push(`Built for ${name}`);
    } else {
      score -= 40; // strongly deprioritize, but keep as a possible filler
    }
  }

  // Budget.
  const model = tool.pricing.model;
  const freeish = model === "free" || model === "freemium";
  if (answers.budget === "free") {
    if (freeish) {
      score += 18;
      reasons.push(model === "free" ? "Completely free" : "Free tier to start");
    } else if (tool.pricing.hasFreeTrial) {
      score += 6;
      reasons.push("Free trial available");
    } else {
      score -= 12;
    }
  } else if (answers.budget === "trial") {
    if (tool.pricing.hasFreeTrial) {
      score += 16;
      reasons.push("Free trial available");
    } else if (freeish) {
      score += 8;
      reasons.push("Free tier to start");
    }
  } // "pay" imposes no budget constraint

  // Platform.
  if (answers.platform && answers.platform !== "any") {
    const wanted = PLATFORM_MATCH[answers.platform];
    if (tool.platforms.some((p) => wanted.includes(p))) {
      score += 16;
      reasons.push(`Works on ${PLATFORM_LABEL[answers.platform]}`);
    } else {
      score -= 20;
    }
  }

  // A single quality flourish, only for genuine standouts.
  if (tool.editorScore >= 8.7) {
    reasons.push(`Editor's pick · ${tool.editorScore.toFixed(1)}`);
  } else if (tool.rating >= 4.6) {
    reasons.push(`Loved by users · ${tool.rating.toFixed(1)}`);
  }

  return { tool, score, reasons: reasons.slice(0, 3) };
}

/** Score every tool. Order: score desc, then stable quality tie-breaks. */
export function scoreTools(
  tools: Tool[],
  answers: FinderAnswers,
  categoryName: Map<string, string>,
): FinderResult[] {
  return [...tools]
    .map((tool) => scoreOne(tool, answers, categoryName))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.tool.editorScore - a.tool.editorScore ||
        b.tool.rating - a.tool.rating ||
        b.tool.reviewCount - a.tool.reviewCount ||
        a.tool.name.localeCompare(b.tool.name),
    );
}

/** Top `n` recommendations for the given answers. */
export function recommendTools(
  tools: Tool[],
  answers: FinderAnswers,
  categoryName: Map<string, string>,
  n = 3,
): FinderResult[] {
  return scoreTools(tools, answers, categoryName).slice(0, n);
}

/* -------------------------------------------------------------- wizard config */

export type FinderStepId = "category" | "budget" | "platform";

export type FinderOption = {
  /** Stored answer value. For the category step this is a category slug or "any". */
  value: string;
  label: string;
  description: string;
  /** Lucide icon name (resolved via the icon registry). */
  icon: string;
};

export type FinderStep = {
  id: FinderStepId;
  /** Eyebrow shown above the question. */
  eyebrow: string;
  /** The question itself. */
  title: string;
  options: FinderOption[];
};

// The 8 seeded categories, phrased as user goals. Kept in sync with
// src/data/categories.ts (slugs must match).
const CATEGORY_OPTIONS: FinderOption[] = [
  { value: "any", label: "Not sure yet", description: "Show me the best all-round tools", icon: "Sparkles" },
  { value: "writing", label: "Write & edit", description: "Draft, rewrite, and polish copy", icon: "PenLine" },
  { value: "image", label: "Create images", description: "Generate art, product shots, illustration", icon: "Image" },
  { value: "coding", label: "Write code", description: "Autocomplete, refactor, and ship faster", icon: "Code" },
  { value: "productivity", label: "Get organized", description: "Notes, planning, and workspace copilots", icon: "Zap" },
  { value: "video", label: "Make video", description: "Generate and edit footage", icon: "Clapperboard" },
  { value: "audio", label: "Work with audio", description: "Voices, narration, and music", icon: "AudioLines" },
  { value: "research", label: "Research & cite", description: "Answers you can actually source", icon: "BookOpen" },
  { value: "marketing", label: "Grow & market", description: "SEO, ads, and agentic campaigns", icon: "Megaphone" },
];

export const FINDER_STEPS: FinderStep[] = [
  {
    id: "category",
    eyebrow: "What brings you here",
    title: "What do you want to do?",
    options: CATEGORY_OPTIONS,
  },
  {
    id: "budget",
    eyebrow: "Your budget",
    title: "How do you want to pay?",
    options: [
      { value: "free", label: "Free to start", description: "I need a genuine free tier", icon: "Gift" },
      { value: "trial", label: "Trial first", description: "Let me try before I buy", icon: "Timer" },
      { value: "pay", label: "Pay for the best", description: "Cost isn't the deciding factor", icon: "Gem" },
    ],
  },
  {
    id: "platform",
    eyebrow: "Where you work",
    title: "Where do you need it to run?",
    options: [
      { value: "any", label: "Anywhere", description: "Platform isn't important", icon: "Globe" },
      { value: "web", label: "In the browser", description: "Web app or extension", icon: "Globe" },
      { value: "mac", label: "macOS", description: "A native Mac app", icon: "Laptop" },
      { value: "windows", label: "Windows", description: "A native Windows app", icon: "Laptop" },
      { value: "mobile", label: "Mobile", description: "iOS or Android", icon: "Smartphone" },
      { value: "api", label: "Dev / API", description: "API, CLI, or IDE integration", icon: "TerminalSquare" },
    ],
  },
];
