import { ImageResponse } from "next/og";
import {
  getAllTools,
  getToolBySlug,
  getCategoryBySlug,
} from "@/lib/content";
import { OG, OG_SIZE, ogFonts, publicImageDataUri } from "@/lib/og";

export const alt = "AI tool review on Enki";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return getAllTools().map((tool) => ({ slug: tool.slug }));
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  const fonts = await ogFonts();

  if (!tool) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: OG.bg,
            color: OG.fg,
            fontFamily: "Cardot",
            fontSize: "72px",
            fontWeight: 600,
          }}
        >
          Enki
        </div>
      ),
      { ...size, fonts },
    );
  }

  const category = getCategoryBySlug(tool.categorySlug);
  const logo = await publicImageDataUri(tool.logo);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG.bg,
          color: OG.fg,
          fontFamily: "Cardot",
          padding: "70px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-180px",
            right: "-120px",
            width: "620px",
            height: "620px",
            display: "flex",
            background:
              "radial-gradient(circle, rgba(0,173,181,0.28), rgba(0,173,181,0) 70%)",
          }}
        />

        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "34px",
              fontWeight: 600,
              letterSpacing: "-1px",
            }}
          >
            ENKI
          </div>
          <div style={{ display: "flex", fontSize: "22px", color: OG.muted }}>
            Human-vetted AI tool intelligence
          </div>
        </div>

        {/* Identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            {logo ? (
              <div
                style={{
                  display: "flex",
                  width: "104px",
                  height: "104px",
                  borderRadius: "24px",
                  background: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "16px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo}
                  width={72}
                  height={72}
                  style={{ objectFit: "contain" }}
                  alt=""
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  width: "104px",
                  height: "104px",
                  borderRadius: "24px",
                  background: "rgba(0,173,181,0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                  color: OG.tealBright,
                  fontSize: "52px",
                  fontWeight: 600,
                }}
              >
                {tool.name.charAt(0)}
              </div>
            )}
            <div
              style={{
                display: "flex",
                fontSize: "24px",
                letterSpacing: "3px",
                color: OG.tealBright,
              }}
            >
              {(category?.name ?? "AI TOOL").toUpperCase()}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "94px",
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: "-3px",
            }}
          >
            {tool.name}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "36px",
              color: OG.soft,
              maxWidth: "1000px",
            }}
          >
            {tool.tagline}
          </div>
        </div>

        {/* Ratings */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(0,173,181,0.12)",
              border: "1px solid rgba(0,173,181,0.45)",
              borderRadius: "999px",
              padding: "12px 26px",
              fontSize: "28px",
            }}
          >
            <div style={{ display: "flex", color: OG.tealBright }}>Rated</div>
            <div style={{ display: "flex", fontWeight: 600 }}>
              {tool.rating.toFixed(1)}
            </div>
            <div style={{ display: "flex", color: OG.muted, fontSize: "22px" }}>
              / 5
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 6px",
              fontSize: "28px",
              color: OG.soft,
            }}
          >
            <div style={{ display: "flex" }}>Editor</div>
            <div style={{ display: "flex", fontWeight: 600, color: OG.tealBright }}>
              {tool.editorScore.toFixed(1)}
            </div>
            <div style={{ display: "flex", color: OG.muted, fontSize: "22px" }}>
              / 10
            </div>
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              fontSize: "24px",
              color: OG.muted,
            }}
          >
            enki.tools
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
