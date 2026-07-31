import type { Author } from "@/lib/schemas";

/**
 * Editorial bylines.
 *
 * Deliberately empty. This file previously defined six named reviewers with job
 * titles ("Mara Okafor, Principal Reviewer" and five others) who did not exist,
 * and the seeded reviews carried their bylines. Invented experts are a
 * materially different thing from placeholder copy, especially on a directory
 * that earns affiliate revenue from its rankings.
 *
 * The schema and plumbing are kept so genuine editorial reviews can be added
 * later under a real byline. Add a person here only when they are real.
 */
export const authors: Author[] = [
  {
    id: "vivaan-kavalani",
    name: "Vivaan Kavalani",
    role: "Founder and reviewer",
    accent: "#00ADB5",
  },
];
