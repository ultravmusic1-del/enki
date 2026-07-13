import type { Tool } from "@/lib/schemas";

/**
 * Tools — Sanity-shaped seed. ~28 tools across 8 categories. Every field here
 * maps to a document field we would author in a live Sanity dataset; the app
 * reads it through `src/lib/content.ts` (GROQ-shaped functions).
 *
 * `accent` is the per-tool monogram colour. `screenshots[].hue` seeds a
 * gradient placeholder "screen". `rating`/`reviewCount` are the canonical
 * displayed aggregates.
 */
export const tools: Tool[] = [
  /* ============================================================ WRITING */
  {
    slug: "jasper",
    logo: "/logos/jasper.png",
    name: "Jasper",
    tagline: "Marketing copy that stays on brand",
    description:
      "An AI content platform built for marketing teams, with brand voice controls, templates, and campaign workflows.",
    longDescription:
      "Jasper is a purpose-built marketing content platform rather than a generic chatbot. It pairs a capable writing model with Brand Voice, memory, and a library of task templates so teams can spin up on-message blog posts, ads, and emails at scale. Its Campaigns feature turns a single brief into a coordinated set of assets, and the browser extension brings Jasper into wherever you already write.",
    website: "https://www.jasper.ai",
    categorySlug: "writing",
    tags: ["copywriting", "marketing", "brand voice", "templates", "teams"],
    pricing: {
      model: "paid",
      startingPrice: "$49/mo",
      hasFreeTrial: true,
      note: "7-day free trial; Creator and Pro tiers billed per seat.",
    },
    pros: [
      "Brand Voice keeps output consistent across a team",
      "Deep library of marketing-specific templates",
      "Campaigns generate a full asset set from one brief",
    ],
    cons: [
      "Pricier than general-purpose assistants",
      "Overkill if you only need occasional drafts",
    ],
    keyFeatures: [
      {
        title: "Brand Voice",
        description:
          "Teach Jasper your tone, style, and vocabulary so every draft sounds like you.",
        icon: "Fingerprint",
      },
      {
        title: "Campaigns",
        description:
          "Turn one brief into a coordinated set of on-message assets across channels.",
        icon: "Megaphone",
      },
      {
        title: "Templates",
        description:
          "50+ task templates for ads, emails, landing pages, and social posts.",
        icon: "LayoutTemplate",
      },
    ],
    integrations: ["Chrome", "Google Docs", "Surfer SEO", "Webflow", "Zapier"],
    platforms: ["Web", "Browser extension", "API"],
    accent: "#00ADB5",
    featured: true,
    foundedYear: 2021,
    company: "Jasper AI, Inc.",
    screenshots: [
      { title: "Campaign builder", caption: "One brief, a full campaign of assets", hue: 184 },
      { title: "Brand Voice", caption: "Tone and vocabulary controls", hue: 190 },
      { title: "Document editor", caption: "Long-form writing with inline commands", hue: 176 },
    ],
    verdict:
      "The strongest pick for marketing teams that need consistent, on-brand output at volume, less compelling for solo, occasional writers.",
    editorScore: 8.4,
    rating: 4.3,
    reviewCount: 1284,
  },
  {
    slug: "copy-ai",
    logo: "/logos/copy-ai.png",
    name: "Copy.ai",
    tagline: "Go-to-market work on autopilot",
    description:
      "A GTM AI platform that automates prospecting, content, and sales workflows with chained prompts and agents.",
    longDescription:
      "Copy.ai started as a copywriting tool and has grown into a go-to-market operating system. Beyond one-off drafts, it lets teams build multi-step workflows that research accounts, draft outreach, and repurpose content automatically. It's aimed at revenue teams that want to wire AI into repeatable processes rather than write prompt-by-prompt.",
    website: "https://www.copy.ai",
    categorySlug: "writing",
    tags: ["copywriting", "workflows", "sales", "automation", "gtm"],
    pricing: {
      model: "freemium",
      startingPrice: "$49/mo",
      hasFreeTrial: true,
      note: "Free tier with limited credits; paid plans unlock workflows.",
    },
    pros: [
      "Workflows automate repeatable GTM tasks",
      "Generous free tier to evaluate",
      "Good at repurposing one asset into many",
    ],
    cons: [
      "Workflow builder has a learning curve",
      "Raw prose quality trails dedicated writing tools",
    ],
    keyFeatures: [
      {
        title: "Workflows",
        description:
          "Chain research, drafting, and formatting steps into reusable automations.",
        icon: "Workflow",
      },
      {
        title: "Infobase",
        description: "Store brand facts and reuse them across every generation.",
        icon: "Database",
      },
      {
        title: "Content repurposing",
        description: "Turn a webinar or post into a dozen channel-ready pieces.",
        icon: "Recycle",
      },
    ],
    integrations: ["HubSpot", "Salesforce", "Zapier", "Google Sheets", "Slack"],
    platforms: ["Web", "API"],
    accent: "#2FB0A8",
    featured: false,
    foundedYear: 2020,
    company: "Copy.ai, Inc.",
    screenshots: [
      { title: "Workflow canvas", caption: "Chained steps for GTM automation", hue: 170 },
      { title: "Chat", caption: "Ad-hoc drafting with brand context", hue: 178 },
    ],
    verdict:
      "Best when you treat it as a workflow engine for revenue teams; as a pure writing tool it's merely fine.",
    editorScore: 7.6,
    rating: 4.1,
    reviewCount: 842,
  },
  {
    slug: "sudowrite",
    logo: "/logos/sudowrite.png",
    name: "Sudowrite",
    tagline: "The AI writing partner for fiction",
    description:
      "A creative-writing studio that brainstorms, describes, and expands prose while preserving the author's style.",
    longDescription:
      "Sudowrite is built for novelists and storytellers rather than marketers. Its Story Bible tracks characters, worldbuilding, and plot so generations stay consistent across a manuscript, while tools like Describe, Expand, and Brainstorm help unblock scenes without flattening your voice. It's the rare AI writer designed around the craft of long-form narrative.",
    website: "https://www.sudowrite.com",
    categorySlug: "writing",
    tags: ["fiction", "creative writing", "novels", "storytelling", "brainstorming"],
    pricing: {
      model: "paid",
      startingPrice: "$19/mo",
      hasFreeTrial: true,
      note: "Trial credits included; tiers scale by monthly word allowance.",
    },
    pros: [
      "Story Bible keeps long manuscripts consistent",
      "Preserves the author's voice unusually well",
      "Purpose-built tools for scenes and description",
    ],
    cons: [
      "Niche: little use outside fiction",
      "Word-credit model can feel limiting on lower tiers",
    ],
    keyFeatures: [
      {
        title: "Story Bible",
        description:
          "Track characters, world, and outline so the AI stays on-canon.",
        icon: "BookMarked",
      },
      {
        title: "Describe",
        description: "Generate sensory description for any object or moment.",
        icon: "Sparkles",
      },
      {
        title: "Expand & Rewrite",
        description: "Stretch a beat or re-voice a passage without losing style.",
        icon: "Wand2",
      },
    ],
    integrations: ["Chrome", "Microsoft Word"],
    platforms: ["Web", "Browser extension"],
    accent: "#9B8CFF",
    featured: false,
    foundedYear: 2020,
    company: "Sudowrite, Inc.",
    screenshots: [
      { title: "Story Bible", caption: "Canon tracking for long manuscripts", hue: 258 },
      { title: "Editor", caption: "Inline creative tools", hue: 250 },
    ],
    verdict:
      "The best AI companion for fiction writers, full stop, as long as prose, not marketing, is your goal.",
    editorScore: 8.1,
    rating: 4.4,
    reviewCount: 613,
  },
  {
    slug: "grammarly",
    logo: "/logos/grammarly.png",
    name: "Grammarly",
    tagline: "Writing help everywhere you type",
    description:
      "A ubiquitous writing assistant for grammar, clarity, tone, and now generative drafting across every app.",
    longDescription:
      "Grammarly is the most widely deployed writing assistant, living in the browser, desktop, and mobile keyboards. Beyond its long-standing grammar and clarity checks, GrammarlyGO adds generative drafting and rewriting tuned to your goals and tone. Its reach (it works in nearly every text field you touch) is its real superpower.",
    website: "https://www.grammarly.com",
    categorySlug: "writing",
    tags: ["grammar", "editing", "tone", "proofreading", "clarity"],
    pricing: {
      model: "freemium",
      startingPrice: "$12/mo",
      hasFreeTrial: false,
      note: "Robust free tier; Premium and Business add advanced suggestions.",
    },
    pros: [
      "Works virtually everywhere you write",
      "Excellent, reliable correctness suggestions",
      "Strong free tier for everyday use",
    ],
    cons: [
      "Generative features trail dedicated AI writers",
      "Tone suggestions can be conservative",
    ],
    keyFeatures: [
      {
        title: "Everywhere assistant",
        description: "Corrections and suggestions in almost any desktop or web app.",
        icon: "Globe",
      },
      {
        title: "Tone detection",
        description: "See how your writing lands and adjust before you send.",
        icon: "Gauge",
      },
      {
        title: "GrammarlyGO",
        description: "Generative drafting and rewriting tuned to your intent.",
        icon: "Sparkles",
      },
    ],
    integrations: ["Chrome", "Microsoft Word", "Google Docs", "Gmail", "Slack"],
    platforms: ["Web", "Windows", "macOS", "iOS", "Android", "Browser extension"],
    accent: "#4FC08D",
    featured: false,
    foundedYear: 2009,
    company: "Grammarly, Inc.",
    screenshots: [
      { title: "Inline suggestions", caption: "Corrections as you type", hue: 152 },
      { title: "Tone insights", caption: "How your message reads", hue: 160 },
    ],
    verdict:
      "Indispensable as a correctness and clarity layer everywhere; think of the generative side as a bonus, not the reason to buy.",
    editorScore: 8.0,
    rating: 4.5,
    reviewCount: 3120,
  },

  /* ============================================================== IMAGE */
  {
    slug: "midjourney",
    logo: "/logos/midjourney.png",
    name: "Midjourney",
    tagline: "The gold standard for AI aesthetics",
    description:
      "A text-to-image model renowned for its painterly, coherent, and strikingly beautiful output.",
    longDescription:
      "Midjourney remains the benchmark for aesthetic quality in generative imagery. Its models produce cohesive, stylish results with less prompt-wrangling than most rivals, and features like style references, character consistency, and a web editor have matured it from a Discord curiosity into a serious creative tool. Artists reach for it when the look matters most.",
    website: "https://www.midjourney.com",
    categorySlug: "image",
    tags: ["text-to-image", "art", "concept art", "illustration", "aesthetics"],
    pricing: {
      model: "paid",
      startingPrice: "$10/mo",
      hasFreeTrial: false,
      note: "Basic through Mega plans scale fast-hours and concurrent jobs.",
    },
    pros: [
      "Best-in-class aesthetic quality",
      "Style and character reference controls",
      "Strong, active creative community",
    ],
    cons: [
      "No meaningful free tier",
      "Fine-grained control still trails some rivals",
    ],
    keyFeatures: [
      {
        title: "Style References",
        description: "Anchor generations to a reference look with --sref.",
        icon: "Palette",
      },
      {
        title: "Character consistency",
        description: "Keep a character coherent across many images.",
        icon: "Users",
      },
      {
        title: "Web editor",
        description: "Inpaint, pan, and vary directly in the browser.",
        icon: "Frame",
      },
    ],
    integrations: ["Discord", "Web"],
    platforms: ["Web", "Discord"],
    accent: "#35E4EC",
    featured: true,
    foundedYear: 2022,
    company: "Midjourney, Inc.",
    screenshots: [
      { title: "Explore feed", caption: "Community generations and prompts", hue: 186 },
      { title: "Create view", caption: "Prompt bar with style controls", hue: 192 },
      { title: "Editor", caption: "Inpainting and variations", hue: 200 },
    ],
    verdict:
      "If you want the most beautiful result with the least fuss, Midjourney is still the one to beat.",
    editorScore: 9.0,
    rating: 4.7,
    reviewCount: 2450,
  },
  {
    slug: "dall-e-3",
    logo: "/logos/dall-e-3.png",
    name: "DALL·E 3",
    tagline: "Prompt-faithful images inside ChatGPT",
    description:
      "OpenAI's image model, tuned for prompt adherence and legible text, available directly in ChatGPT.",
    longDescription:
      "DALL·E 3 trades some of Midjourney's painterly flair for exceptional prompt adherence and the convenience of living inside ChatGPT. It handles complex, multi-part prompts and in-image text better than most, and the conversational interface lets you refine an image by simply describing what to change, no prompt syntax required.",
    website: "https://openai.com/dall-e-3",
    categorySlug: "image",
    tags: ["text-to-image", "openai", "chatgpt", "prompt adherence"],
    pricing: {
      model: "freemium",
      startingPrice: "$20/mo",
      hasFreeTrial: false,
      note: "Limited free access; included with ChatGPT Plus.",
    },
    pros: [
      "Follows complex prompts faithfully",
      "Handles in-image text unusually well",
      "Conversational refinement in ChatGPT",
    ],
    cons: [
      "Less distinctive style than Midjourney",
      "Tight content filters can block benign prompts",
    ],
    keyFeatures: [
      {
        title: "Prompt adherence",
        description: "Renders multi-part prompts more literally than most models.",
        icon: "Target",
      },
      {
        title: "Conversational edits",
        description: "Refine an image by describing the change in plain language.",
        icon: "MessagesSquare",
      },
      {
        title: "Legible text",
        description: "Better at rendering readable words inside images.",
        icon: "Type",
      },
    ],
    integrations: ["ChatGPT", "Microsoft Designer", "API"],
    platforms: ["Web", "API"],
    accent: "#7CD4A6",
    featured: false,
    foundedYear: 2023,
    company: "OpenAI",
    screenshots: [
      { title: "ChatGPT image", caption: "Generate inside a conversation", hue: 150 },
      { title: "Refinement", caption: "Describe a change, get a revision", hue: 158 },
    ],
    verdict:
      "The most convenient way to get an image that matches a fussy prompt. Reach for it when accuracy beats artistry.",
    editorScore: 8.2,
    rating: 4.3,
    reviewCount: 1670,
  },
  {
    slug: "stable-diffusion",
    logo: "/logos/stable-diffusion.png",
    name: "Stable Diffusion",
    tagline: "Open-source image generation you control",
    description:
      "An open family of image models you can run locally, fine-tune, and extend with a vast ecosystem.",
    longDescription:
      "Stable Diffusion is the open-source backbone of the generative-image world. Because the weights are open, you can run it locally for free, fine-tune it on your own images, and tap a huge ecosystem of community models, LoRAs, and ControlNet extensions. It trades turnkey polish for unmatched control and privacy.",
    website: "https://stability.ai",
    categorySlug: "image",
    tags: ["open source", "local", "fine-tuning", "controlnet", "self-hosted"],
    pricing: {
      model: "free",
      startingPrice: "Free (self-hosted)",
      hasFreeTrial: true,
      note: "Weights are free; paid API and membership options exist.",
    },
    pros: [
      "Run locally, free and private",
      "Enormous ecosystem of models and extensions",
      "Deepest control via ControlNet and fine-tuning",
    ],
    cons: [
      "Steep setup and hardware requirements",
      "Quality depends heavily on chosen model and tuning",
    ],
    keyFeatures: [
      {
        title: "Open weights",
        description: "Download, run, and modify the models yourself.",
        icon: "Lock",
      },
      {
        title: "ControlNet",
        description: "Guide generations with poses, depth, edges, and more.",
        icon: "SlidersHorizontal",
      },
      {
        title: "Fine-tuning",
        description: "Train the model on your own subject or style.",
        icon: "Cog",
      },
    ],
    integrations: ["ComfyUI", "Automatic1111", "Hugging Face", "API"],
    platforms: ["Windows", "macOS", "Linux", "Web", "API"],
    accent: "#59B0FF",
    featured: false,
    foundedYear: 2022,
    company: "Stability AI",
    screenshots: [
      { title: "ComfyUI graph", caption: "Node-based generation pipeline", hue: 212 },
      { title: "ControlNet", caption: "Pose and depth guidance", hue: 220 },
    ],
    verdict:
      "Unbeatable for control, cost, and privacy if you're willing to tinker; not for anyone who wants one-click polish.",
    editorScore: 8.3,
    rating: 4.2,
    reviewCount: 1980,
  },
  {
    slug: "adobe-firefly",
    logo: "/logos/adobe-firefly.png",
    name: "Adobe Firefly",
    tagline: "Commercially safe generation, built into Creative Cloud",
    description:
      "Adobe's image model, trained on licensed content and woven into Photoshop and the Creative Cloud suite.",
    longDescription:
      "Firefly is Adobe's answer to generative imagery, differentiated by a training set of licensed and public-domain content that makes it commercially safe for enterprise use. Its real strength is integration: Generative Fill and Expand live inside Photoshop, and Firefly powers generative features across the Creative Cloud apps designers already use every day.",
    website: "https://www.adobe.com/products/firefly.html",
    categorySlug: "image",
    tags: ["adobe", "photoshop", "generative fill", "commercial-safe", "design"],
    pricing: {
      model: "freemium",
      startingPrice: "$9.99/mo",
      hasFreeTrial: true,
      note: "Monthly generative credits; included with Creative Cloud plans.",
    },
    pros: [
      "Commercially safe, enterprise-friendly training data",
      "Deeply integrated into Photoshop and CC",
      "Generative Fill/Expand are genuinely useful",
    ],
    cons: [
      "Standalone quality trails Midjourney",
      "Credit system can throttle heavy use",
    ],
    keyFeatures: [
      {
        title: "Generative Fill",
        description: "Add, remove, or extend content directly in Photoshop.",
        icon: "PaintBucket",
      },
      {
        title: "Commercial safety",
        description: "Trained on licensed content for worry-free commercial use.",
        icon: "ShieldCheck",
      },
      {
        title: "CC integration",
        description: "Powers generative features across Creative Cloud apps.",
        icon: "Layers",
      },
    ],
    integrations: ["Photoshop", "Illustrator", "Express", "Lightroom"],
    platforms: ["Web", "Windows", "macOS", "iOS", "Android"],
    accent: "#F2A65A",
    featured: false,
    foundedYear: 2023,
    company: "Adobe Inc.",
    screenshots: [
      { title: "Generative Fill", caption: "Editing inside Photoshop", hue: 30 },
      { title: "Firefly web", caption: "Text-to-image with content controls", hue: 38 },
    ],
    verdict:
      "The obvious choice for teams already in Creative Cloud that need commercially safe assets, less so as a standalone art tool.",
    editorScore: 7.9,
    rating: 4.2,
    reviewCount: 1440,
  },

  /* ============================================================= CODING */
  {
    slug: "github-copilot",
    logo: "/logos/github-copilot.png",
    name: "GitHub Copilot",
    tagline: "The AI pair programmer, in your editor",
    description:
      "Autocomplete, chat, and agentic coding help inside VS Code, JetBrains, and the GitHub workflow.",
    longDescription:
      "GitHub Copilot popularized AI pair programming and remains the most widely adopted assistant. Beyond inline completions it now offers chat, an agent mode that can edit across files, and pull-request summaries, all wired into the editors and the GitHub platform developers already live in. Its model choice and enterprise controls have matured considerably.",
    website: "https://github.com/features/copilot",
    categorySlug: "coding",
    tags: ["autocomplete", "pair programming", "vscode", "chat", "agents"],
    pricing: {
      model: "freemium",
      startingPrice: "$10/mo",
      hasFreeTrial: true,
      note: "Free tier with monthly limits; Pro and Business add more.",
    },
    pros: [
      "Excellent inline completions across languages",
      "Native to VS Code, JetBrains, and GitHub",
      "Agent mode edits across files",
    ],
    cons: [
      "Chat quality trails dedicated agentic editors",
      "Best value requires living in the GitHub ecosystem",
    ],
    keyFeatures: [
      {
        title: "Inline completions",
        description: "Context-aware suggestions as you type, whole-line to whole-function.",
        icon: "TextCursorInput",
      },
      {
        title: "Copilot Chat",
        description: "Ask about your codebase, fix errors, and generate tests.",
        icon: "MessageSquareCode",
      },
      {
        title: "Agent mode",
        description: "Delegate multi-file changes and let Copilot iterate.",
        icon: "Bot",
      },
    ],
    integrations: ["VS Code", "JetBrains", "Visual Studio", "Neovim", "GitHub"],
    platforms: ["VS Code", "JetBrains", "Web", "CLI"],
    accent: "#8BD4D9",
    featured: true,
    foundedYear: 2021,
    company: "GitHub (Microsoft)",
    screenshots: [
      { title: "Inline suggestion", caption: "Ghost-text completions", hue: 188 },
      { title: "Copilot Chat", caption: "Ask about your code", hue: 196 },
      { title: "Agent mode", caption: "Multi-file edits with review", hue: 204 },
    ],
    verdict:
      "The safe default for most developers: deeply integrated, reliable, and improving fast, even if purpose-built agents edge it on ambitious tasks.",
    editorScore: 8.7,
    rating: 4.5,
    reviewCount: 3890,
  },
  {
    slug: "cursor",
    logo: "/logos/cursor.png",
    name: "Cursor",
    tagline: "The AI-first code editor",
    description:
      "A VS Code fork rebuilt around AI, with fast completions, codebase chat, and a powerful agent.",
    longDescription:
      "Cursor reimagines the editor with AI at the center rather than bolted on. It indexes your whole codebase for context-aware chat, offers uncanny multi-line completions via its Tab model, and its Agent can plan and execute sweeping changes across files. For developers who want AI woven into every keystroke, Cursor sets the pace.",
    website: "https://www.cursor.com",
    categorySlug: "coding",
    tags: ["editor", "agents", "codebase chat", "completions", "vscode-fork"],
    pricing: {
      model: "freemium",
      startingPrice: "$20/mo",
      hasFreeTrial: true,
      note: "Hobby free tier; Pro unlocks more fast requests and agents.",
    },
    pros: [
      "Best-in-class agent for large, multi-file changes",
      "Codebase-aware chat with deep context",
      "Familiar VS Code foundation and extensions",
    ],
    cons: [
      "Heavy usage can hit rate limits or add cost",
      "Rapid updates occasionally introduce rough edges",
    ],
    keyFeatures: [
      {
        title: "Agent",
        description: "Plan and execute changes across your whole codebase.",
        icon: "Bot",
      },
      {
        title: "Tab completions",
        description: "Predicts your next edit, not just the next token.",
        icon: "Keyboard",
      },
      {
        title: "Codebase chat",
        description: "Ask questions with full-repo context and citations.",
        icon: "MessageSquareCode",
      },
    ],
    integrations: ["VS Code extensions", "GitHub", "MCP servers"],
    platforms: ["Windows", "macOS", "Linux"],
    accent: "#00ADB5",
    featured: true,
    foundedYear: 2023,
    company: "Anysphere",
    screenshots: [
      { title: "Agent panel", caption: "Plan-and-execute across files", hue: 184 },
      { title: "Tab model", caption: "Next-edit prediction", hue: 178 },
      { title: "Codebase chat", caption: "Repo-aware answers", hue: 172 },
    ],
    verdict:
      "The most capable agentic editor available today, the tool to beat if you want AI at the center of your workflow.",
    editorScore: 9.1,
    rating: 4.6,
    reviewCount: 2210,
  },
  {
    slug: "windsurf",
    logo: "/logos/windsurf.png",
    name: "Windsurf",
    tagline: "Agentic IDE with flow-state focus",
    description:
      "An AI-native editor whose Cascade agent keeps context across your codebase and terminal.",
    longDescription:
      "Windsurf (formerly Codeium's editor) is an agentic IDE designed around uninterrupted flow. Its Cascade agent maintains a running understanding of your project (files, edits, and terminal) so it can carry out multi-step tasks with minimal hand-holding. Free-tier completions remain generous, making it an accessible on-ramp to agentic coding.",
    website: "https://windsurf.com",
    categorySlug: "coding",
    tags: ["editor", "agents", "cascade", "completions", "flow"],
    pricing: {
      model: "freemium",
      startingPrice: "$15/mo",
      hasFreeTrial: true,
      note: "Capable free tier; Pro adds premium model credits.",
    },
    pros: [
      "Cascade agent tracks project state well",
      "Generous free completions",
      "Clean, focused interface",
    ],
    cons: [
      "Smaller extension ecosystem than Cursor",
      "Premium model access gated by credits",
    ],
    keyFeatures: [
      {
        title: "Cascade",
        description: "An agent that keeps context across files and terminal.",
        icon: "Waves",
      },
      {
        title: "Supercomplete",
        description: "Intent-aware completions beyond the next line.",
        icon: "Keyboard",
      },
      {
        title: "In-editor commands",
        description: "Refactor and generate with natural-language commands.",
        icon: "TerminalSquare",
      },
    ],
    integrations: ["VS Code extensions", "GitHub", "MCP servers"],
    platforms: ["Windows", "macOS", "Linux"],
    accent: "#59B0FF",
    featured: false,
    foundedYear: 2024,
    company: "Codeium",
    screenshots: [
      { title: "Cascade", caption: "Agent with project memory", hue: 214 },
      { title: "Editor", caption: "Flow-focused workspace", hue: 208 },
    ],
    verdict:
      "A strong, more affordable rival to Cursor, especially compelling if the free tier covers your needs.",
    editorScore: 8.5,
    rating: 4.4,
    reviewCount: 1120,
  },
  {
    slug: "replit-agent",
    logo: "/logos/replit-agent.png",
    name: "Replit Agent",
    tagline: "Describe an app; it builds and deploys it",
    description:
      "A cloud IDE whose agent scaffolds, codes, and ships full applications from a prompt.",
    longDescription:
      "Replit pairs a zero-setup cloud development environment with an agent that can build and deploy full apps from a natural-language description. Because everything runs in the browser (editor, database, hosting), it's uniquely friendly to beginners and prototypers who want to go from idea to running URL without touching local tooling.",
    website: "https://replit.com",
    categorySlug: "coding",
    tags: ["cloud ide", "agents", "deploy", "prototyping", "beginner-friendly"],
    pricing: {
      model: "freemium",
      startingPrice: "$20/mo",
      hasFreeTrial: true,
      note: "Free tier to explore; Core adds agent usage and deployments.",
    },
    pros: [
      "Zero local setup: code and host in the browser",
      "Agent scaffolds and deploys full apps",
      "Great for beginners and rapid prototypes",
    ],
    cons: [
      "Less suited to large production codebases",
      "Agent usage can get costly at scale",
    ],
    keyFeatures: [
      {
        title: "Agent",
        description: "Build, edit, and deploy an app from a description.",
        icon: "Bot",
      },
      {
        title: "Instant hosting",
        description: "Deploy to a live URL without leaving the browser.",
        icon: "Rocket",
      },
      {
        title: "Full cloud IDE",
        description: "Editor, database, and secrets in one workspace.",
        icon: "Cloud",
      },
    ],
    integrations: ["GitHub", "PostgreSQL", "Stripe", "Object Storage"],
    platforms: ["Web", "iOS", "Android"],
    accent: "#F2A65A",
    featured: false,
    foundedYear: 2016,
    company: "Replit, Inc.",
    screenshots: [
      { title: "Agent build", caption: "Prompt to running app", hue: 32 },
      { title: "Workspace", caption: "Editor, shell, and preview", hue: 40 },
    ],
    verdict:
      "The fastest path from idea to a deployed app for beginners and prototypers; reach for a local setup once projects grow serious.",
    editorScore: 8.0,
    rating: 4.2,
    reviewCount: 960,
  },

  /* ======================================================== PRODUCTIVITY */
  {
    slug: "notion-ai",
    logo: "/logos/notion-ai.png",
    name: "Notion AI",
    tagline: "Your workspace, now with a brain",
    description:
      "AI woven into Notion that drafts, summarizes, and answers questions across your connected workspace.",
    longDescription:
      "Notion AI brings generative help directly into the docs, wikis, and databases teams already keep in Notion. It can draft and edit inline, autofill database properties, and, via connected apps and Q&A, answer questions using your organization's own knowledge. Because it lives where your content already is, there's no context to copy-paste.",
    website: "https://www.notion.so/product/ai",
    categorySlug: "productivity",
    tags: ["workspace", "notes", "summarization", "q&a", "databases"],
    pricing: {
      model: "freemium",
      startingPrice: "$10/mo",
      hasFreeTrial: true,
      note: "Add-on per member; included in higher Notion plans.",
    },
    pros: [
      "AI where your docs and data already live",
      "Q&A over your whole workspace",
      "Database autofill saves real time",
    ],
    cons: [
      "Only as useful as your Notion adoption",
      "Q&A quality varies with workspace tidiness",
    ],
    keyFeatures: [
      {
        title: "Workspace Q&A",
        description: "Ask questions answered from your own connected content.",
        icon: "MessagesSquare",
      },
      {
        title: "Inline writing",
        description: "Draft, summarize, and rewrite anywhere in a page.",
        icon: "PenLine",
      },
      {
        title: "Database autofill",
        description: "Let AI populate properties from page content.",
        icon: "Table",
      },
    ],
    integrations: ["Slack", "Google Drive", "GitHub", "Jira"],
    platforms: ["Web", "Windows", "macOS", "iOS", "Android"],
    accent: "#7CD4A6",
    featured: false,
    foundedYear: 2023,
    company: "Notion Labs, Inc.",
    screenshots: [
      { title: "Workspace Q&A", caption: "Answers from your own docs", hue: 150 },
      { title: "Inline AI", caption: "Draft and edit in place", hue: 156 },
    ],
    verdict:
      "A no-brainer add-on if your team already runs on Notion; not a reason to switch to it on its own.",
    editorScore: 7.8,
    rating: 4.3,
    reviewCount: 1510,
  },
  {
    slug: "mem",
    logo: "/logos/mem.png",
    name: "Mem",
    tagline: "The self-organizing notes app",
    description:
      "An AI notes tool that files, links, and resurfaces your knowledge so you never manually organize again.",
    longDescription:
      "Mem inverts the usual notes workflow: instead of foldering everything yourself, you capture freely and let AI organize, connect, and resurface. Its Smart Search and chat answer questions from your accumulated notes, and related-notes suggestions surface context you'd forgotten you had. It's built for people who hate maintaining a knowledge system.",
    website: "https://get.mem.ai",
    categorySlug: "productivity",
    tags: ["notes", "knowledge", "search", "auto-organize", "second brain"],
    pricing: {
      model: "freemium",
      startingPrice: "$8.33/mo",
      hasFreeTrial: true,
      note: "Free plan available; paid unlocks full AI features.",
    },
    pros: [
      "No manual foldering: AI organizes for you",
      "Fast, natural-language search over notes",
      "Surfaces relevant past context automatically",
    ],
    cons: [
      "Less structured than database-style tools",
      "Best value only once you've captured a lot",
    ],
    keyFeatures: [
      {
        title: "Auto-organization",
        description: "Capture freely; AI files and links your notes.",
        icon: "Sparkles",
      },
      {
        title: "Smart Search",
        description: "Ask in natural language and get synthesized answers.",
        icon: "Search",
      },
      {
        title: "Related notes",
        description: "Surfaces connected context as you write.",
        icon: "Network",
      },
    ],
    integrations: ["Calendar", "Chrome", "iOS Shortcuts"],
    platforms: ["Web", "macOS", "iOS", "Android"],
    accent: "#B58CFF",
    featured: false,
    foundedYear: 2019,
    company: "Mem Labs",
    screenshots: [
      { title: "Smart Search", caption: "Answers from your notes", hue: 262 },
      { title: "Timeline", caption: "Auto-organized capture", hue: 254 },
    ],
    verdict:
      "A refreshing take for capture-heavy thinkers who resent organizing; structure lovers may miss the folders.",
    editorScore: 7.5,
    rating: 4.1,
    reviewCount: 540,
  },
  {
    slug: "motion",
    logo: "/logos/motion.png",
    name: "Motion",
    tagline: "AI that plans your day for you",
    description:
      "A calendar and task manager that auto-schedules your work around meetings, priorities, and deadlines.",
    longDescription:
      "Motion merges tasks, projects, and calendar into one AI planner that continuously rebuilds your schedule. Add a task with a deadline and priority, and Motion slots it into open time, reshuffling automatically when meetings appear or plans slip. It's aimed at people drowning in commitments who want the system, not them, to decide what happens next.",
    website: "https://www.usemotion.com",
    categorySlug: "productivity",
    tags: ["calendar", "scheduling", "tasks", "planning", "time-blocking"],
    pricing: {
      model: "paid",
      startingPrice: "$19/mo",
      hasFreeTrial: true,
      note: "7-day trial; billed annually per user.",
    },
    pros: [
      "Automatic, deadline-aware scheduling",
      "Unifies tasks, projects, and calendar",
      "Reshuffles intelligently when plans change",
    ],
    cons: [
      "No free tier",
      "Rigid for people who like manual control",
    ],
    keyFeatures: [
      {
        title: "Auto-scheduling",
        description: "AI time-blocks tasks around your meetings and priorities.",
        icon: "CalendarClock",
      },
      {
        title: "Project management",
        description: "Track projects with AI-planned task timelines.",
        icon: "KanbanSquare",
      },
      {
        title: "Meeting booking",
        description: "Shareable booking pages that respect your real availability.",
        icon: "CalendarPlus",
      },
    ],
    integrations: ["Google Calendar", "Outlook", "Zoom", "Zapier"],
    platforms: ["Web", "Windows", "macOS", "iOS", "Android"],
    accent: "#00ADB5",
    featured: false,
    foundedYear: 2019,
    company: "Motion (Labs, Inc.)",
    screenshots: [
      { title: "Auto-schedule", caption: "Tasks placed into open time", hue: 184 },
      { title: "Projects", caption: "AI-planned timelines", hue: 190 },
    ],
    verdict:
      "Genuinely transformative for the over-committed who'll cede control to the algorithm; a poor fit for manual planners.",
    editorScore: 7.9,
    rating: 4.0,
    reviewCount: 720,
  },

  /* =============================================================== VIDEO */
  {
    slug: "runway",
    logo: "/logos/runway.png",
    name: "Runway",
    tagline: "A creative suite for AI video",
    description:
      "Generative video models plus a full editing toolkit for filmmakers and motion designers.",
    longDescription:
      "Runway is the most complete AI video studio, pairing its Gen-series text- and image-to-video models with a deep toolkit: motion brush, camera controls, inpainting, and green-screen. It's used on real productions for previsualization, effects, and short-form content, and its steady model releases keep it near the frontier of generative motion.",
    website: "https://runwayml.com",
    categorySlug: "video",
    tags: ["text-to-video", "image-to-video", "editing", "vfx", "filmmaking"],
    pricing: {
      model: "freemium",
      startingPrice: "$15/mo",
      hasFreeTrial: true,
      note: "Free trial credits; plans scale by generation credits.",
    },
    pros: [
      "Most complete AI video toolkit",
      "Fine motion and camera controls",
      "Used on real productions",
    ],
    cons: [
      "Credits burn quickly at high quality",
      "Clip length and coherence still limited",
    ],
    keyFeatures: [
      {
        title: "Gen video models",
        description: "Text- and image-to-video generation near the frontier.",
        icon: "Clapperboard",
      },
      {
        title: "Motion Brush",
        description: "Direct motion by painting exactly what should move.",
        icon: "Brush",
      },
      {
        title: "Editing tools",
        description: "Inpainting, green-screen, and camera controls in one suite.",
        icon: "Scissors",
      },
    ],
    integrations: ["API", "Adobe Premiere (export)"],
    platforms: ["Web", "iOS", "API"],
    accent: "#B58CFF",
    featured: true,
    foundedYear: 2018,
    company: "Runway AI, Inc.",
    screenshots: [
      { title: "Generate", caption: "Text- and image-to-video", hue: 262 },
      { title: "Motion Brush", caption: "Paint motion onto a still", hue: 270 },
      { title: "Editor", caption: "Compositing and cleanup", hue: 256 },
    ],
    verdict:
      "The pick for creators who want generation plus real editing control in one place. The credit meter is the only real drawback.",
    editorScore: 8.6,
    rating: 4.4,
    reviewCount: 1330,
  },
  {
    slug: "pika",
    logo: "/logos/pika.png",
    name: "Pika",
    tagline: "Playful, fast AI video for social",
    description:
      "A text- and image-to-video app known for fun effects and quick, shareable clips.",
    longDescription:
      "Pika focuses on approachable, expressive video generation with a social bent. Its signature Pikaffects and Pikaframes let creators apply eye-catching transformations and control start/end frames without a steep learning curve. It's less a production suite than a fast, delightful way to make short clips worth sharing.",
    website: "https://pika.art",
    categorySlug: "video",
    tags: ["text-to-video", "effects", "social", "short-form", "fun"],
    pricing: {
      model: "freemium",
      startingPrice: "$10/mo",
      hasFreeTrial: true,
      note: "Free monthly credits; paid tiers unlock higher resolution.",
    },
    pros: [
      "Fun, distinctive effects",
      "Low learning curve",
      "Fast, shareable output",
    ],
    cons: [
      "Less control than production suites",
      "Short clip lengths",
    ],
    keyFeatures: [
      {
        title: "Pikaffects",
        description: "One-tap transformations that make clips pop.",
        icon: "Sparkles",
      },
      {
        title: "Pikaframes",
        description: "Control start and end frames for guided motion.",
        icon: "Frame",
      },
      {
        title: "Image-to-video",
        description: "Animate a still image with a prompt.",
        icon: "Play",
      },
    ],
    integrations: ["Discord", "Web"],
    platforms: ["Web", "iOS", "Discord"],
    accent: "#E86A92",
    featured: false,
    foundedYear: 2023,
    company: "Pika Labs",
    screenshots: [
      { title: "Effects", caption: "Signature Pikaffects", hue: 336 },
      { title: "Create", caption: "Prompt to short clip", hue: 344 },
    ],
    verdict:
      "The most fun way to make short, social-ready clips; look elsewhere for precise, production-grade control.",
    editorScore: 7.7,
    rating: 4.1,
    reviewCount: 680,
  },
  {
    slug: "synthesia",
    logo: "/logos/synthesia.png",
    name: "Synthesia",
    tagline: "AI avatars for training and comms video",
    description:
      "Turn a script into a polished presenter-led video with realistic AI avatars in 140+ languages.",
    longDescription:
      "Synthesia is the leader in AI avatar video, built for enterprise learning, onboarding, and internal comms. Paste a script, pick from 230+ avatars (or clone your own), and it renders a professional presenter video in minutes, then re-render instantly when the script changes. Its multilingual reach makes localizing training content trivial.",
    website: "https://www.synthesia.io",
    categorySlug: "video",
    tags: ["avatars", "training", "localization", "enterprise", "explainer"],
    pricing: {
      model: "paid",
      startingPrice: "$29/mo",
      hasFreeTrial: true,
      note: "Free demo video; Starter and Creator tiers by minutes.",
    },
    pros: [
      "Realistic avatars and natural voices",
      "140+ languages for easy localization",
      "Update the script and re-render instantly",
    ],
    cons: [
      "Not for narrative or cinematic video",
      "Custom avatars gated to higher tiers",
    ],
    keyFeatures: [
      {
        title: "AI avatars",
        description: "230+ stock presenters plus custom avatar cloning.",
        icon: "UserRound",
      },
      {
        title: "Multilingual",
        description: "Generate and dub in 140+ languages.",
        icon: "Languages",
      },
      {
        title: "Script-to-video",
        description: "Paste a script and render a presenter video in minutes.",
        icon: "FileVideo",
      },
    ],
    integrations: ["SCORM", "LMS export", "PowerPoint", "API"],
    platforms: ["Web", "API"],
    accent: "#59B0FF",
    featured: false,
    foundedYear: 2017,
    company: "Synthesia Ltd.",
    screenshots: [
      { title: "Avatar studio", caption: "Presenter-led video from a script", hue: 214 },
      { title: "Languages", caption: "One video, many languages", hue: 220 },
    ],
    verdict:
      "The category leader for training and corporate comms video; the wrong tool if you want storytelling or cinematic footage.",
    editorScore: 8.3,
    rating: 4.5,
    reviewCount: 1190,
  },

  /* =============================================================== AUDIO */
  {
    slug: "elevenlabs",
    logo: "/logos/elevenlabs.png",
    name: "ElevenLabs",
    tagline: "The most lifelike AI voices",
    description:
      "Text-to-speech and voice cloning with uncanny realism, expressive control, and broad language support.",
    longDescription:
      "ElevenLabs sets the bar for AI speech, delivering natural prosody and emotion that most rivals can't match. It offers instant and professional voice cloning, a growing voice library, dubbing that preserves the original speaker's voice across languages, and a low-latency API that powers agents and apps. For narration, localization, and voice interfaces, it's the default.",
    website: "https://elevenlabs.io",
    categorySlug: "audio",
    tags: ["text-to-speech", "voice cloning", "dubbing", "narration", "api"],
    pricing: {
      model: "freemium",
      startingPrice: "$5/mo",
      hasFreeTrial: true,
      note: "Free monthly characters; paid tiers scale usage and cloning.",
    },
    pros: [
      "Most lifelike, expressive voices available",
      "Fast, high-quality voice cloning",
      "Low-latency API for real-time use",
    ],
    cons: [
      "Character limits add up for long content",
      "Cloning raises understandable ethics concerns",
    ],
    keyFeatures: [
      {
        title: "Lifelike TTS",
        description: "Natural prosody and emotion across many voices.",
        icon: "AudioLines",
      },
      {
        title: "Voice cloning",
        description: "Instant or professional clones from your own samples.",
        icon: "Mic",
      },
      {
        title: "Dubbing",
        description: "Translate audio while keeping the speaker's voice.",
        icon: "Languages",
      },
    ],
    integrations: ["API", "Zapier", "Descript", "Discord"],
    platforms: ["Web", "iOS", "Android", "API"],
    accent: "#00ADB5",
    featured: true,
    foundedYear: 2022,
    company: "ElevenLabs Inc.",
    screenshots: [
      { title: "Voice library", caption: "Browse and audition voices", hue: 184 },
      { title: "Speech synthesis", caption: "Text to lifelike audio", hue: 178 },
      { title: "Dubbing", caption: "Localize while keeping the voice", hue: 172 },
    ],
    verdict:
      "The clear leader in AI voice: realistic, flexible, and developer-friendly. The obvious first pick for any speech project.",
    editorScore: 9.0,
    rating: 4.7,
    reviewCount: 2040,
  },
  {
    slug: "murf",
    logo: "/logos/murf.png",
    name: "Murf",
    tagline: "Studio-quality voiceovers for teams",
    description:
      "A voiceover studio with polished voices, sync tools, and collaboration for videos and e-learning.",
    longDescription:
      "Murf targets teams making voiceovers for videos, presentations, and e-learning. Alongside a large library of professional voices it provides a full studio (timing sync with video, pronunciation controls, and collaboration), plus features to voice-change your own recordings. It trades ElevenLabs' cutting-edge realism for a smoother production workflow.",
    website: "https://murf.ai",
    categorySlug: "audio",
    tags: ["voiceover", "text-to-speech", "e-learning", "collaboration"],
    pricing: {
      model: "freemium",
      startingPrice: "$19/mo",
      hasFreeTrial: true,
      note: "Free minutes to try; paid plans by voice-generation hours.",
    },
    pros: [
      "Polished production and sync tools",
      "Large library of professional voices",
      "Team collaboration built in",
    ],
    cons: [
      "Realism trails ElevenLabs",
      "Best value only for regular voiceover work",
    ],
    keyFeatures: [
      {
        title: "Voice studio",
        description: "Emphasis, pitch, and pause controls for polished reads.",
        icon: "SlidersHorizontal",
      },
      {
        title: "Video sync",
        description: "Align voiceover timing to your footage.",
        icon: "AudioWaveform",
      },
      {
        title: "Collaboration",
        description: "Shared projects and review for teams.",
        icon: "Users",
      },
    ],
    integrations: ["Google Slides", "Canva", "API"],
    platforms: ["Web", "API"],
    accent: "#F2A65A",
    featured: false,
    foundedYear: 2020,
    company: "Murf AI",
    screenshots: [
      { title: "Studio", caption: "Timing and emphasis controls", hue: 32 },
      { title: "Voices", caption: "Library of professional reads", hue: 40 },
    ],
    verdict:
      "A dependable choice for teams that value a smooth voiceover workflow over bleeding-edge realism.",
    editorScore: 7.6,
    rating: 4.2,
    reviewCount: 610,
  },
  {
    slug: "suno",
    logo: "/logos/suno.png",
    name: "Suno",
    tagline: "Full songs from a single prompt",
    description:
      "Generate complete, radio-ready songs (vocals, lyrics, and instruments) from a text description.",
    longDescription:
      "Suno generates complete songs, not just backing tracks: describe a style and topic and it writes lyrics, sings them, and produces a full arrangement. Its coherence and audio quality have made AI music genuinely fun and usable for demos, jingles, and social content. Custom-lyrics mode and personas give creators more direction over the result.",
    website: "https://suno.com",
    categorySlug: "audio",
    tags: ["music generation", "songs", "lyrics", "vocals", "creative"],
    pricing: {
      model: "freemium",
      startingPrice: "$8/mo",
      hasFreeTrial: true,
      note: "Free daily credits; paid tiers add commercial use and more songs.",
    },
    pros: [
      "Generates complete songs with vocals",
      "Surprisingly high audio quality",
      "Fast and genuinely fun to use",
    ],
    cons: [
      "Limited fine control over arrangement",
      "Commercial rights require a paid plan",
    ],
    keyFeatures: [
      {
        title: "Song generation",
        description: "Lyrics, vocals, and arrangement from one prompt.",
        icon: "Music",
      },
      {
        title: "Custom lyrics",
        description: "Bring your own words and let Suno compose around them.",
        icon: "PenLine",
      },
      {
        title: "Personas",
        description: "Reuse a vocal and stylistic signature across songs.",
        icon: "UserRound",
      },
    ],
    integrations: ["Web", "API"],
    platforms: ["Web", "iOS", "Android"],
    accent: "#E86A92",
    featured: false,
    foundedYear: 2023,
    company: "Suno, Inc.",
    screenshots: [
      { title: "Create", caption: "Prompt to a full song", hue: 336 },
      { title: "Library", caption: "Your generated tracks", hue: 344 },
    ],
    verdict:
      "The most impressive AI music tool for full songs, magical for demos and fun, still short on granular control.",
    editorScore: 8.2,
    rating: 4.3,
    reviewCount: 990,
  },

  /* ============================================================ RESEARCH */
  {
    slug: "perplexity",
    logo: "/logos/perplexity.png",
    name: "Perplexity",
    tagline: "The answer engine you can cite",
    description:
      "A conversational search engine that answers questions with synthesized, source-cited responses.",
    longDescription:
      "Perplexity reimagines search as a conversation: ask a question and it returns a concise, synthesized answer with inline citations you can verify. Its Pro Search runs deeper multi-step research, Spaces organize projects, and focus modes scope answers to academic papers or the web. For fast, trustworthy answers, it has become many people's default over traditional search.",
    website: "https://www.perplexity.ai",
    categorySlug: "research",
    tags: ["search", "answer engine", "citations", "research", "q&a"],
    pricing: {
      model: "freemium",
      startingPrice: "$20/mo",
      hasFreeTrial: true,
      note: "Free tier is capable; Pro adds deeper search and more models.",
    },
    pros: [
      "Answers with verifiable inline citations",
      "Fast and genuinely useful free tier",
      "Pro Search handles multi-step questions",
    ],
    cons: [
      "Can still surface the occasional weak source",
      "Best models reserved for Pro",
    ],
    keyFeatures: [
      {
        title: "Cited answers",
        description: "Every response links the sources it drew from.",
        icon: "Quote",
      },
      {
        title: "Pro Search",
        description: "Multi-step research for complex questions.",
        icon: "Telescope",
      },
      {
        title: "Spaces",
        description: "Organize research threads and files by project.",
        icon: "FolderKanban",
      },
    ],
    integrations: ["Chrome", "iOS", "Android", "API"],
    platforms: ["Web", "iOS", "Android", "Browser extension"],
    accent: "#8BD4D9",
    featured: true,
    foundedYear: 2022,
    company: "Perplexity AI, Inc.",
    screenshots: [
      { title: "Answer", caption: "Synthesized response with citations", hue: 186 },
      { title: "Pro Search", caption: "Deeper multi-step research", hue: 192 },
    ],
    verdict:
      "The best everyday answer engine: fast, cited, and trustworthy enough to replace a lot of traditional searching.",
    editorScore: 8.8,
    rating: 4.6,
    reviewCount: 2260,
  },
  {
    slug: "elicit",
    logo: "/logos/elicit.png",
    name: "Elicit",
    tagline: "AI research assistant for the literature",
    description:
      "Search, screen, and extract findings from academic papers with a structured, evidence-first workflow.",
    longDescription:
      "Elicit is built for researchers doing real literature work. It searches across tens of millions of papers, builds structured data-extraction tables across studies, and summarizes findings with links back to the source. By keeping everything grounded in cited papers, it speeds up systematic reviews without the hallucination risk of general chatbots.",
    website: "https://elicit.com",
    categorySlug: "research",
    tags: ["academic", "papers", "literature review", "extraction", "science"],
    pricing: {
      model: "freemium",
      startingPrice: "$12/mo",
      hasFreeTrial: true,
      note: "Free monthly credits; paid tiers add extraction and columns.",
    },
    pros: [
      "Grounded in real, cited papers",
      "Structured extraction across many studies",
      "Big time-saver for literature reviews",
    ],
    cons: [
      "Narrowly focused on academic work",
      "Extraction credits can run out fast",
    ],
    keyFeatures: [
      {
        title: "Paper search",
        description: "Semantic search across 125M+ academic papers.",
        icon: "Search",
      },
      {
        title: "Data extraction",
        description: "Pull structured findings into comparison tables.",
        icon: "Table",
      },
      {
        title: "Systematic review",
        description: "Screen and summarize studies with citations.",
        icon: "ClipboardList",
      },
    ],
    integrations: ["Zotero", "CSV export"],
    platforms: ["Web"],
    accent: "#7CD4A6",
    featured: false,
    foundedYear: 2021,
    company: "Elicit (Ought)",
    screenshots: [
      { title: "Search", caption: "Semantic search over papers", hue: 150 },
      { title: "Extraction table", caption: "Structured findings across studies", hue: 156 },
    ],
    verdict:
      "An outstanding accelerator for anyone doing serious literature review; irrelevant if you're not working with papers.",
    editorScore: 8.1,
    rating: 4.4,
    reviewCount: 430,
  },
  {
    slug: "consensus",
    logo: "/logos/consensus.png",
    name: "Consensus",
    tagline: "Evidence-based answers from science",
    description:
      "An AI search engine that answers questions using findings drawn directly from peer-reviewed research.",
    longDescription:
      "Consensus answers questions by surfacing conclusions from peer-reviewed studies rather than the open web. Its Consensus Meter summarizes how much the literature agrees on a yes/no question, and every claim links to the paper behind it. It's a fast way to get a grounded, science-backed read on a topic without wading through journals yourself.",
    website: "https://consensus.app",
    categorySlug: "research",
    tags: ["science", "evidence", "papers", "search", "citations"],
    pricing: {
      model: "freemium",
      startingPrice: "$9/mo",
      hasFreeTrial: true,
      note: "Free tier with limited AI credits; Premium unlocks more.",
    },
    pros: [
      "Answers grounded in peer-reviewed studies",
      "Consensus Meter shows scientific agreement",
      "Every claim links to its source",
    ],
    cons: [
      "Limited to questions science can answer",
      "AI features metered on the free tier",
    ],
    keyFeatures: [
      {
        title: "Consensus Meter",
        description: "See how much research agrees on a yes/no question.",
        icon: "Gauge",
      },
      {
        title: "Study snapshots",
        description: "Key findings summarized with links to each paper.",
        icon: "FileText",
      },
      {
        title: "Evidence search",
        description: "Search conclusions across peer-reviewed literature.",
        icon: "Microscope",
      },
    ],
    integrations: ["Web", "ChatGPT plugin"],
    platforms: ["Web", "iOS", "Android"],
    accent: "#8BD4D9",
    featured: false,
    foundedYear: 2021,
    company: "Consensus NLP, Inc.",
    screenshots: [
      { title: "Consensus Meter", caption: "How much the science agrees", hue: 186 },
      { title: "Results", caption: "Findings with source links", hue: 192 },
    ],
    verdict:
      "A trustworthy shortcut to what the research actually says, best kept to questions science can answer.",
    editorScore: 7.8,
    rating: 4.2,
    reviewCount: 380,
  },

  /* =========================================================== MARKETING */
  {
    slug: "surfer-seo",
    logo: "/logos/surfer-seo.png",
    name: "Surfer SEO",
    tagline: "Write content that ranks",
    description:
      "A content-optimization platform that guides writing to match what actually ranks on Google.",
    longDescription:
      "Surfer analyzes the top-ranking pages for a keyword and turns them into a concrete content brief: target terms, structure, length, and questions to cover. Its Content Editor scores your draft in real time, and an AI writer can generate optimized drafts to start from. It's the bridge between good writing and content that actually earns search traffic.",
    website: "https://surferseo.com",
    categorySlug: "marketing",
    tags: ["seo", "content", "optimization", "keywords", "serp"],
    pricing: {
      model: "paid",
      startingPrice: "$59/mo",
      hasFreeTrial: false,
      note: "Essential to Enterprise tiers by article and tracking volume.",
    },
    pros: [
      "Data-driven briefs based on real SERPs",
      "Real-time content scoring as you write",
      "Integrates into existing writing tools",
    ],
    cons: [
      "Pricey for occasional publishers",
      "Over-optimization can flatten voice if unchecked",
    ],
    keyFeatures: [
      {
        title: "Content Editor",
        description: "Real-time optimization score and term guidance.",
        icon: "Gauge",
      },
      {
        title: "SERP analysis",
        description: "Reverse-engineer what ranks for your keyword.",
        icon: "ChartBar",
      },
      {
        title: "Content briefs",
        description: "Auto-generate structure, terms, and questions to cover.",
        icon: "ClipboardList",
      },
    ],
    integrations: ["Google Docs", "WordPress", "Jasper", "Contentful"],
    platforms: ["Web", "Browser extension"],
    accent: "#E86A92",
    featured: false,
    foundedYear: 2017,
    company: "Surfer (Colline sp. z o.o.)",
    screenshots: [
      { title: "Content Editor", caption: "Live optimization scoring", hue: 336 },
      { title: "SERP analyzer", caption: "What ranks and why", hue: 344 },
    ],
    verdict:
      "The go-to for teams serious about ranking; watch that its scores guide, not dictate, your writing.",
    editorScore: 8.0,
    rating: 4.3,
    reviewCount: 870,
  },
  {
    slug: "adcreative-ai",
    logo: "/logos/adcreative-ai.png",
    name: "AdCreative.ai",
    tagline: "High-converting ad creative, generated",
    description:
      "Generate and score ad creatives, banners, and product photos tuned for conversion across channels.",
    longDescription:
      "AdCreative.ai produces on-brand ad creatives and banners at scale, then scores each for likely conversion based on trained performance data. It pulls your brand kit, generates variations across sizes and platforms, and even creates AI product photography, aimed at performance marketers who need volume without a design bottleneck.",
    website: "https://www.adcreative.ai",
    categorySlug: "marketing",
    tags: ["ads", "creative", "banners", "conversion", "design"],
    pricing: {
      model: "paid",
      startingPrice: "$39/mo",
      hasFreeTrial: true,
      note: "7-day trial; plans scale by monthly credits and download volume.",
    },
    pros: [
      "Fast, on-brand creative at volume",
      "Conversion scoring to prioritize variants",
      "Exports for every ad size and platform",
    ],
    cons: [
      "Output can feel templated",
      "Credit model gets pricey at scale",
    ],
    keyFeatures: [
      {
        title: "Creative generation",
        description: "On-brand ads and banners in every required size.",
        icon: "Images",
      },
      {
        title: "Conversion scoring",
        description: "Predict which variants are likely to perform.",
        icon: "TrendingUp",
      },
      {
        title: "Product photography",
        description: "Generate studio-style product shots from photos.",
        icon: "Camera",
      },
    ],
    integrations: ["Google Ads", "Meta Ads", "Zapier", "Shopify"],
    platforms: ["Web"],
    accent: "#F2A65A",
    featured: false,
    foundedYear: 2021,
    company: "AdCreative.ai",
    screenshots: [
      { title: "Generator", caption: "On-brand ad variants at scale", hue: 32 },
      { title: "Scoring", caption: "Conversion prediction per variant", hue: 40 },
    ],
    verdict:
      "A real productivity win for performance marketers who need creative volume; expect to art-direct away the templated feel.",
    editorScore: 7.4,
    rating: 4.0,
    reviewCount: 560,
  },
  {
    slug: "clay",
    logo: "/logos/clay.png",
    name: "Clay",
    tagline: "AI-powered data and outbound at scale",
    description:
      "A prospecting platform that enriches leads from 100+ sources and drafts personalized outreach with AI.",
    longDescription:
      "Clay is a spreadsheet-native growth engine: pull in leads, enrich them from 100+ data providers in one place, and use an AI research agent (Claygent) to gather custom signals and write personalized messages at scale. It replaces a stack of disconnected enrichment tools and powers highly targeted, non-generic outbound.",
    website: "https://www.clay.com",
    categorySlug: "marketing",
    tags: ["prospecting", "enrichment", "outbound", "agents", "sales"],
    pricing: {
      model: "freemium",
      startingPrice: "$149/mo",
      hasFreeTrial: true,
      note: "Free plan with limited credits; paid tiers scale enrichment.",
    },
    pros: [
      "100+ enrichment sources in one waterfall",
      "Claygent researches and writes at scale",
      "Replaces a whole stack of point tools",
    ],
    cons: [
      "Powerful but genuinely complex to learn",
      "Credit costs add up on large lists",
    ],
    keyFeatures: [
      {
        title: "Enrichment waterfall",
        description: "Chain 100+ providers to maximize data coverage.",
        icon: "Layers",
      },
      {
        title: "Claygent",
        description: "An AI agent that researches accounts and writes copy.",
        icon: "Bot",
      },
      {
        title: "Spreadsheet UX",
        description: "Familiar tables that trigger enrichment and automation.",
        icon: "Table",
      },
    ],
    integrations: ["HubSpot", "Salesforce", "Outreach", "Slack", "Zapier"],
    platforms: ["Web", "API"],
    accent: "#59B0FF",
    featured: false,
    foundedYear: 2017,
    company: "Clay Labs, Inc.",
    screenshots: [
      { title: "Enrichment table", caption: "Waterfall data in a spreadsheet", hue: 214 },
      { title: "Claygent", caption: "AI research and copy per row", hue: 220 },
    ],
    verdict:
      "Extraordinarily powerful for modern outbound if you invest in learning it; overkill for simple list-building.",
    editorScore: 8.4,
    rating: 4.5,
    reviewCount: 720,
  },
];
