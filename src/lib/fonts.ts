import localFont from "next/font/local";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

// Cardot — the brand display face. Distinctive, oracular. Used for headings only.
export const cardot = localFont({
  src: [
    { path: "../fonts/Cardot-nAal4.otf", weight: "400", style: "normal" },
    { path: "../fonts/CardotSemibold-R9w6e.otf", weight: "600", style: "normal" },
  ],
  variable: "--font-display",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

// Hanken Grotesk — refined, warm grotesk for body & UI. Not the generic Inter/Roboto.
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// IBM Plex Mono — technical eyebrows, tags, ratings, metadata. Reinforces the "verified" feel.
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const fontVariables = `${cardot.variable} ${hanken.variable} ${plexMono.variable}`;
