import type { Author } from "@/lib/schemas";

/**
 * The Enki editorial voices. Reviews reference these by `id`. `accent` tints
 * each reviewer's avatar monogram.
 */
export const authors: Author[] = [
  {
    id: "mara-okafor",
    name: "Mara Okafor",
    role: "Principal Reviewer",
    accent: "#00ADB5",
  },
  {
    id: "dev-ramanathan",
    name: "Dev Ramanathan",
    role: "Developer Tools Lead",
    accent: "#59B0FF",
  },
  {
    id: "lena-voss",
    name: "Lena Voss",
    role: "Creative Director",
    accent: "#B58CFF",
  },
  {
    id: "theo-marchetti",
    name: "Theo Marchetti",
    role: "Productivity Analyst",
    accent: "#7CD4A6",
  },
  {
    id: "amira-hassan",
    name: "Amira Hassan",
    role: "Research Editor",
    accent: "#8BD4D9",
  },
  {
    id: "jonah-pierce",
    name: "Jonah Pierce",
    role: "Growth & Marketing",
    accent: "#E86A92",
  },
];
