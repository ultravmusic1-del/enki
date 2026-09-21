import { ImageResponse } from "next/og";
import { OG, OG_SIZE, ogFonts } from "@/lib/og";
import { getPublishedStory } from "@/lib/news/stories";

export const alt = "AI news on Enki";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [story, fonts] = await Promise.all([getPublishedStory(slug), ogFonts()]);
  const headline = story?.headline ?? "AI news on Enki";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: OG.bg,
          color: OG.fg,
          fontFamily: "Cardot",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: OG.teal, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          {story ? story.beatName : "Enki news"}
        </div>
        <div style={{ display: "flex", fontSize: headline.length > 90 ? 52 : 64, fontWeight: 600, lineHeight: 1.1 }}>
          {headline}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: OG.muted }}>
          <span>{story ? `Via ${story.sourceName}` : "enkitools.com"}</span>
          <span style={{ color: OG.soft }}>Enki</span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
