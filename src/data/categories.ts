import type { Category } from "@/lib/schemas";

/**
 * Categories — Sanity-shaped seed. `icon` is a Lucide icon name resolved via
 * the icon registry. `accent` tints the category card's emblem/glow.
 */
export const categories: Category[] = [
  {
    slug: "writing",
    name: "Writing & Content",
    tagline: "Draft, edit, and refine at the speed of thought",
    description:
      "Assistants that help you outline, draft, rewrite, and polish everything from marketing copy to long-form fiction, without losing your voice.",
    icon: "PenLine",
    accent: "#00ADB5",
  },
  {
    slug: "image",
    name: "Image Generation",
    tagline: "Conjure visuals from a sentence",
    description:
      "Text-to-image models and creative suites for concept art, product shots, illustration, and design exploration at any fidelity.",
    icon: "Image",
    accent: "#35E4EC",
  },
  {
    slug: "coding",
    name: "Coding & Dev",
    tagline: "Pair-programmers that keep up",
    description:
      "AI coding assistants, agentic editors, and review tools that autocomplete, refactor, explain, and ship alongside your team.",
    icon: "Code",
    accent: "#59B0FF",
  },
  {
    slug: "productivity",
    name: "Productivity",
    tagline: "Reclaim the hours the day steals",
    description:
      "Notetakers, planners, and workspace copilots that summarize, schedule, and surface exactly what you need, when you need it.",
    icon: "Zap",
    accent: "#7CD4A6",
  },
  {
    slug: "video",
    name: "Video",
    tagline: "From prompt to picture, in motion",
    description:
      "Generative video models, avatar studios, and AI editors that storyboard, cut, and render footage without a full production crew.",
    icon: "Clapperboard",
    accent: "#B58CFF",
  },
  {
    slug: "audio",
    name: "Audio & Voice",
    tagline: "Voices, scores, and songs on demand",
    description:
      "Text-to-speech, voice cloning, and music generation for narration, localization, podcasts, and original soundtracks.",
    icon: "AudioLines",
    accent: "#F2A65A",
  },
  {
    slug: "research",
    name: "Research & Knowledge",
    tagline: "Answers you can actually cite",
    description:
      "Answer engines and literature tools that search, synthesize, and cite real sources so you can trust what you learn.",
    icon: "BookOpen",
    accent: "#8BD4D9",
  },
  {
    slug: "marketing",
    name: "Marketing & Agents",
    tagline: "Autonomous help for growth work",
    description:
      "SEO copilots, ad-creative generators, and agentic workflows that research, produce, and optimize campaigns end to end.",
    icon: "Megaphone",
    accent: "#E86A92",
  },
];
