import { XMLParser } from "fast-xml-parser";
import { isHttpUrl } from "@/lib/safe-url";

export type FeedItem = {
  title: string;
  url: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
};

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

const EXCERPT_MAX = 1000;
const ARRAY_TAGS = new Set([
  "item",
  "entry",
  "link",
  "enclosure",
  "media:content",
  "media:thumbnail",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => ARRAY_TAGS.has(name),
  parseTagValue: false,
});

type Node = Record<string, unknown>;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

/** Numeric and named HTML entities → the characters they represent (no tag handling). */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      const isSurrogate = code >= 0xd800 && code <= 0xdfff;
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !isSurrogate
        ? String.fromCodePoint(code)
        : "";
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** HTML fragment → plain text: tags removed, entities decoded, whitespace collapsed. */
export function cleanText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object" && "#text" in value) return text((value as Node)["#text"]);
  return "";
}

function attr(value: unknown, name: string): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const found = (value as Node)[`@_${name}`];
    return typeof found === "string" ? found.trim() : "";
  }
  return "";
}

/** Only https images: an http image on an https page is blocked as mixed content. */
function httpsOnly(url: string): string | null {
  return /^https:\/\//i.test(url) && isHttpUrl(url) ? url : null;
}

function parseDate(value: string): Date | null {
  if (!value.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function excerptFrom(html: string): string | null {
  const cleaned = cleanText(html);
  if (!cleaned) return null;
  const codePoints = Array.from(cleaned);
  return codePoints.length > EXCERPT_MAX
    ? `${codePoints.slice(0, EXCERPT_MAX - 1).join("")}…`
    : cleaned;
}

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp|avif)$/i;

/** True when `url`'s path (ignoring any query string or fragment) looks like an image file. */
function hasImageExtension(url: string): boolean {
  return IMAGE_EXTENSION_RE.test(url.split(/[?#]/)[0] ?? "");
}

function imageFrom(node: Node, bodyHtml: string): string | null {
  for (const enclosure of asArray(node.enclosure)) {
    if (attr(enclosure, "type").startsWith("image/")) {
      const url = httpsOnly(attr(enclosure, "url"));
      if (url) return url;
    }
  }
  for (const key of ["media:content", "media:thumbnail"]) {
    for (const media of asArray(node[key])) {
      const medium = attr(media, "medium");
      const type = attr(media, "type");
      if ((medium && medium !== "image") || (type && !type.startsWith("image/"))) continue;
      const rawUrl = attr(media, "url");
      if (!medium && !type && !hasImageExtension(rawUrl)) continue;
      const url = httpsOnly(rawUrl);
      if (url) return url;
    }
  }
  const inline = /<img[^>]+src=["']([^"']+)["']/i.exec(bodyHtml);
  return inline ? httpsOnly(decodeEntities(inline[1])) : null;
}

type RawItem = {
  title: string;
  url: string;
  excerptHtml: string;
  bodyHtml: string;
  date: string;
  node: Node;
};

function toItem(raw: RawItem): FeedItem | null {
  const title = cleanText(raw.title);
  const url = raw.url.trim();
  if (!title || !isHttpUrl(url)) return null;
  return {
    title,
    url,
    excerpt: excerptFrom(raw.excerptHtml || raw.bodyHtml),
    imageUrl: imageFrom(raw.node, raw.bodyHtml),
    publishedAt: parseDate(raw.date),
  };
}

function fromRss(node: Node): FeedItem | null {
  const guid = text(node.guid);
  const description = text(node.description);
  return toItem({
    title: text(node.title),
    url: text(node.link) || (isHttpUrl(guid) ? guid : ""),
    excerptHtml: description,
    bodyHtml: text(node["content:encoded"]) || description,
    date: text(node.pubDate) || text(node["dc:date"]),
    node,
  });
}

function fromAtom(node: Node): FeedItem | null {
  const links = asArray(node.link);
  const alternate = links.find((l) => ["", "alternate"].includes(attr(l, "rel")));
  const summary = text(node.summary);
  return toItem({
    title: text(node.title),
    url: attr(alternate, "href"),
    excerptHtml: summary,
    bodyHtml: text(node.content) || summary,
    date: text(node.published) || text(node.updated),
    node,
  });
}

/** Parse an RSS 2.0, RSS 1.0 (RDF) or Atom document into feed items. */
export function parseFeed(xml: string): FeedItem[] {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (error) {
    throw new FeedParseError(`Not well-formed XML: ${(error as Error).message}`);
  }

  const rss = doc.rss as Node | undefined;
  const rdf = doc["rdf:RDF"] as Node | undefined;
  const atom = doc.feed as Node | undefined;

  let nodes: unknown[];
  let read: (node: Node) => FeedItem | null;
  if (rss?.channel) {
    nodes = asArray((rss.channel as Node).item);
    read = fromRss;
  } else if (rdf) {
    nodes = asArray(rdf.item);
    read = fromRss;
  } else if (atom) {
    nodes = asArray(atom.entry);
    read = fromAtom;
  } else {
    throw new FeedParseError("Document is not an RSS or Atom feed");
  }

  return nodes
    .filter((n): n is Node => typeof n === "object" && n !== null)
    .map(read)
    .filter((i): i is FeedItem => i !== null);
}
