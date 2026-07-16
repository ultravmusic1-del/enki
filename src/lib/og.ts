import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Shared sizing + brand palette for generated OpenGraph images. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG = {
  bg: "#16191d",
  fg: "#eeeeee",
  muted: "#8b96a2",
  soft: "#c3ccd6",
  teal: "#00adb5",
  tealBright: "#35e4ec",
} as const;

/** Load the Cardot display face (TTF) for satori/ImageResponse. */
export async function ogFonts() {
  const dir = join(process.cwd(), "src", "fonts");
  const [regular, semibold] = await Promise.all([
    readFile(join(dir, "Cardot-lxq6q.ttf")),
    readFile(join(dir, "CardotSemibold-1jzKM.ttf")),
  ]);
  return [
    { name: "Cardot", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Cardot", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}

/** Read a /public image into a data URI (for embedding logos in an OG image). */
export async function publicImageDataUri(path?: string): Promise<string | null> {
  if (!path) return null;
  try {
    const buf = await readFile(join(process.cwd(), "public", path));
    const ext = path.endsWith(".svg")
      ? "svg+xml"
      : path.endsWith(".jpg") || path.endsWith(".jpeg")
        ? "jpeg"
        : "png";
    return `data:image/${ext};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
