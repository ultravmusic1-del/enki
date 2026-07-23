import { ImageResponse } from "next/og";

// Crisp, tiny brand icon generated at build time — the teal Enki emblem on the
// brand-dark tile, mirroring public/icon.svg. Replaces a heavy static PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16191d",
        }}
      >
        <svg
          width="128"
          height="128"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#35e4ec"
            d="M16.00 4.00 L17.80 11.66 L24.49 7.51 L20.34 14.20 L28.00 16.00 L20.34 17.80 L24.49 24.49 L17.80 20.34 L16.00 28.00 L14.20 20.34 L7.51 24.49 L11.66 17.80 L4.00 16.00 L11.66 14.20 L7.51 7.51 L14.20 11.66 Z"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
