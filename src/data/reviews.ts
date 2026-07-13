import type { Review } from "@/lib/schemas";

/**
 * Authored qualitative reviews. We write a handful for notable tools rather
 * than thousands — the aggregate `rating`/`reviewCount` live on the tool, and
 * the 5-bucket star distribution is synthesized deterministically in
 * `content.ts`. These add human texture on detail pages.
 */
export const reviews: Review[] = [
  /* jasper */
  {
    id: "rev-jasper-1",
    toolSlug: "jasper",
    authorId: "jonah-pierce",
    rating: 5,
    title: "Brand Voice finally made AI usable for our team",
    body: "We tried generic assistants for a year and everything came out sounding like a press release. Jasper's Brand Voice, trained on our best posts, is the first time AI output needed only light edits. Campaigns saved our launch week.",
    date: "2025-11-18",
    helpful: 64,
    verified: true,
  },
  {
    id: "rev-jasper-2",
    toolSlug: "jasper",
    authorId: "mara-okafor",
    rating: 4,
    title: "Excellent for teams, steep for solo use",
    body: "The templates and campaign tooling are genuinely strong and the output is on-brand. The one caveat is price — if you're a solo creator writing occasionally, you're paying for a lot of team machinery you won't touch.",
    date: "2025-10-02",
    helpful: 31,
    verified: true,
  },
  {
    id: "rev-jasper-3",
    toolSlug: "jasper",
    authorId: "lena-voss",
    rating: 4,
    title: "Great copy, keep a human in the loop",
    body: "It gets you 80% of the way on ad copy in seconds. I still edit for punch and to strip the occasional cliché, but as a first-draft engine for a marketing team it's hard to beat.",
    date: "2025-09-14",
    helpful: 18,
    verified: false,
  },

  /* midjourney */
  {
    id: "rev-midjourney-1",
    toolSlug: "midjourney",
    authorId: "lena-voss",
    rating: 5,
    title: "Nothing else looks this good out of the box",
    body: "I've used every major model and Midjourney still wins on pure aesthetics. Style references changed my workflow — I can lock a look across a whole moodboard. The web editor finally makes it feel like a real tool, not a Discord experiment.",
    date: "2025-12-01",
    helpful: 92,
    verified: true,
  },
  {
    id: "rev-midjourney-2",
    toolSlug: "midjourney",
    authorId: "mara-okafor",
    rating: 4,
    title: "Gorgeous, but precise control is still hard",
    body: "For beautiful, evocative imagery it's unmatched. When I need an exact composition or specific text in the image, I sometimes fall back to other tools. Worth every cent for concept work regardless.",
    date: "2025-11-05",
    helpful: 40,
    verified: true,
  },

  /* github-copilot */
  {
    id: "rev-copilot-1",
    toolSlug: "github-copilot",
    authorId: "dev-ramanathan",
    rating: 5,
    title: "The completions alone pay for it",
    body: "Even ignoring chat and agents, the inline suggestions save me an hour a day across boilerplate and tests. It's woven so tightly into VS Code and GitHub that I forget it's a separate product.",
    date: "2025-12-10",
    helpful: 77,
    verified: true,
  },
  {
    id: "rev-copilot-2",
    toolSlug: "github-copilot",
    authorId: "theo-marchetti",
    rating: 4,
    title: "Reliable default, agents are catching up",
    body: "For everyday coding it's the safe, dependable choice. The agent mode is solid now, though for really ambitious multi-file refactors I still reach for a dedicated agentic editor. The trajectory is impressive.",
    date: "2025-11-22",
    helpful: 29,
    verified: true,
  },

  /* cursor */
  {
    id: "rev-cursor-1",
    toolSlug: "cursor",
    authorId: "dev-ramanathan",
    rating: 5,
    title: "The agent genuinely changed how I work",
    body: "I now describe a feature and let the agent draft it across files while I review. The Tab model's next-edit prediction is spooky-good. It's the first tool that made me feel like I'm directing rather than typing.",
    date: "2025-12-08",
    helpful: 88,
    verified: true,
  },
  {
    id: "rev-cursor-2",
    toolSlug: "cursor",
    authorId: "mara-okafor",
    rating: 4,
    title: "Powerful, mind the usage limits",
    body: "It's the most capable editor I've used, full stop. On heavy days I hit fast-request limits and have to pace myself or pay more. Still, the productivity gain more than justifies it.",
    date: "2025-11-15",
    helpful: 35,
    verified: true,
  },

  /* runway */
  {
    id: "rev-runway-1",
    toolSlug: "runway",
    authorId: "lena-voss",
    rating: 5,
    title: "A real production tool, not a toy",
    body: "Motion Brush and camera controls give me the direction I need for previs and short pieces. We used Runway shots in a client deliverable last month. Clip length is still a constraint, but the toolkit is unmatched.",
    date: "2025-12-03",
    helpful: 54,
    verified: true,
  },
  {
    id: "rev-runway-2",
    toolSlug: "runway",
    authorId: "theo-marchetti",
    rating: 4,
    title: "Brilliant, but the credits vanish",
    body: "Quality at the top settings is fantastic. The catch is credit burn — a few high-res generations and you're topping up. Budget accordingly and it's the best all-in-one video suite out there.",
    date: "2025-11-09",
    helpful: 22,
    verified: false,
  },

  /* elevenlabs */
  {
    id: "rev-elevenlabs-1",
    toolSlug: "elevenlabs",
    authorId: "amira-hassan",
    rating: 5,
    title: "Indistinguishable from a real narrator",
    body: "We narrate our research digests with ElevenLabs and listeners genuinely can't tell. The prosody and emotion are miles ahead of anything else, and the API latency is low enough for live use.",
    date: "2025-12-12",
    helpful: 71,
    verified: true,
  },
  {
    id: "rev-elevenlabs-2",
    toolSlug: "elevenlabs",
    authorId: "jonah-pierce",
    rating: 5,
    title: "Dubbing opened up new markets for us",
    body: "Localizing our videos while keeping the original voice used to be impossible on our budget. Now it's a few clicks. Character limits on long content are the only thing I watch.",
    date: "2025-11-27",
    helpful: 38,
    verified: true,
  },

  /* perplexity */
  {
    id: "rev-perplexity-1",
    toolSlug: "perplexity",
    authorId: "amira-hassan",
    rating: 5,
    title: "It replaced most of my Googling",
    body: "The cited answers are what sold me — I can verify every claim in a click. Pro Search handles the messy multi-part questions that traditional search chokes on. It's my first stop now.",
    date: "2025-12-06",
    helpful: 83,
    verified: true,
  },
  {
    id: "rev-perplexity-2",
    toolSlug: "perplexity",
    authorId: "dev-ramanathan",
    rating: 4,
    title: "Fast and trustworthy, occasional weak source",
    body: "Ninety percent of the time it's exactly right with great citations. Now and then it leans on a thin source, so I still sanity-check anything critical. The free tier alone is more useful than most paid tools.",
    date: "2025-11-19",
    helpful: 27,
    verified: true,
  },

  /* suno */
  {
    id: "rev-suno-1",
    toolSlug: "suno",
    authorId: "lena-voss",
    rating: 4,
    title: "Genuinely magical for demos",
    body: "I made a full jingle for a pitch in ten minutes and the client loved it. Fine control over the arrangement is limited, but for demos, social clips, and just fun it's astonishing how good the output is.",
    date: "2025-11-30",
    helpful: 33,
    verified: true,
  },

  /* synthesia */
  {
    id: "rev-synthesia-1",
    toolSlug: "synthesia",
    authorId: "theo-marchetti",
    rating: 5,
    title: "Localized training video without a studio",
    body: "We turned a written onboarding guide into presenter videos in nine languages. When policy changes, we edit the script and re-render — no reshoots. For internal comms it's a category of its own.",
    date: "2025-12-04",
    helpful: 46,
    verified: true,
  },

  /* notion-ai */
  {
    id: "rev-notion-1",
    toolSlug: "notion-ai",
    authorId: "theo-marchetti",
    rating: 4,
    title: "Best when your workspace is already tidy",
    body: "Workspace Q&A is great when your docs are well organized and thin when they aren't. Database autofill quietly saves a ton of busywork. Since we already live in Notion, adding AI was a no-brainer.",
    date: "2025-11-12",
    helpful: 24,
    verified: true,
  },

  /* clay */
  {
    id: "rev-clay-1",
    toolSlug: "clay",
    authorId: "jonah-pierce",
    rating: 5,
    title: "Replaced five tools with one",
    body: "The enrichment waterfall alone justifies Clay — coverage jumped and our stack shrank. Claygent writing custom research per lead is the unlock for outbound that doesn't read like a template. Steep to learn, worth it.",
    date: "2025-12-09",
    helpful: 51,
    verified: true,
  },
  {
    id: "rev-clay-2",
    toolSlug: "clay",
    authorId: "mara-okafor",
    rating: 4,
    title: "Immensely capable, plan your credits",
    body: "There's a real learning curve and the credits go quickly on big lists, but nothing else gives you this much control over enrichment and personalization in one place. Budget and ramp deliberately.",
    date: "2025-11-21",
    helpful: 19,
    verified: false,
  },

  /* stable-diffusion */
  {
    id: "rev-sd-1",
    toolSlug: "stable-diffusion",
    authorId: "dev-ramanathan",
    rating: 4,
    title: "Unmatched control if you'll tinker",
    body: "Running it locally with ControlNet gives me precision no hosted tool offers, and it's free. The setup and GPU requirements are real though — this is for people who enjoy the plumbing.",
    date: "2025-10-28",
    helpful: 30,
    verified: true,
  },

  /* grammarly */
  {
    id: "rev-grammarly-1",
    toolSlug: "grammarly",
    authorId: "amira-hassan",
    rating: 5,
    title: "The one assistant that's truly everywhere",
    body: "It catches issues in email, docs, and every text box I touch. The correctness suggestions are consistently reliable. I treat the generative features as a bonus rather than the reason I keep it.",
    date: "2025-11-08",
    helpful: 42,
    verified: true,
  },

  /* windsurf */
  {
    id: "rev-windsurf-1",
    toolSlug: "windsurf",
    authorId: "dev-ramanathan",
    rating: 4,
    title: "Cursor's most credible rival",
    body: "Cascade keeps context impressively well and the free tier is generous enough to really evaluate. The extension ecosystem is thinner, but for the price-to-capability ratio it's excellent.",
    date: "2025-11-25",
    helpful: 26,
    verified: true,
  },
];
