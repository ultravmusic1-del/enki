import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";
import { OG, OG_SIZE, ogFonts } from "@/lib/og";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: OG.bg,
          color: OG.fg,
          fontFamily: "Cardot",
          padding: "80px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-160px",
            right: "-140px",
            width: "680px",
            height: "680px",
            display: "flex",
            background:
              "radial-gradient(circle, rgba(0,173,181,0.32), rgba(0,173,181,0) 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: "26px",
            letterSpacing: "4px",
            color: OG.tealBright,
          }}
        >
          THE ORACLE FOR AI TOOLS
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "108px",
            fontWeight: 600,
            letterSpacing: "-3px",
            marginTop: "18px",
          }}
        >
          {siteConfig.name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "40px",
            color: OG.soft,
            marginTop: "8px",
            maxWidth: "900px",
          }}
        >
          {siteConfig.tagline}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginTop: "56px",
            fontSize: "26px",
            color: OG.muted,
          }}
        >
          <div style={{ display: "flex", color: OG.teal }}>Curated</div>
          <div
            style={{
              display: "flex",
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: OG.muted,
            }}
          />
          <div style={{ display: "flex", color: OG.teal }}>Human-vetted</div>
          <div
            style={{
              display: "flex",
              width: "6px",
              height: "6px",
              borderRadius: "999px",
              background: OG.muted,
            }}
          />
          <div style={{ display: "flex" }}>enki.tools</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
