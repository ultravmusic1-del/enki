import { FOUNDER_HEADING } from "@/lib/news/schemas";

/**
 * The restricted Markdown a story body is written in (full-stories spec §4):
 * paragraphs, "## " headings, "- " list items, **bold** and https links.
 * Everything else stays literal text. The output is data, never HTML, so a
 * body cannot inject markup.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "heading"; text: string }
  | { type: "list"; items: Inline[][] };

const INLINE = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) out.push({ type: "text", text: text.slice(last, start) });
    if (match[1] !== undefined) out.push({ type: "bold", text: match[1] });
    else out.push({ type: "link", text: match[2], href: match[3] });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

export function parseArticleBody(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", inlines: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushList();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      flushParagraph();
      list.push(parseInline(line.slice(2).trim()));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** The body before the founder heading, and the heading plus everything after it. */
export function splitFounderSection(blocks: Block[]): { main: Block[]; founders: Block[] | null } {
  const at = blocks.findIndex((b) => b.type === "heading" && b.text === FOUNDER_HEADING);
  if (at === -1) return { main: blocks, founders: null };
  return { main: blocks.slice(0, at), founders: blocks.slice(at) };
}
