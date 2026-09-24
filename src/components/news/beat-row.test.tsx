import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const pathname = vi.fn(() => "/news/beat/research");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

const { BeatRow } = await import("@/components/news/beat-row");

afterEach(cleanup);

describe("BeatRow", () => {
  it("links Latest, the five beats and the directory", () => {
    render(<BeatRow />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/news",
      "/news/beat/models-labs",
      "/news/beat/products-launches",
      "/news/beat/funding-business",
      "/news/beat/policy-safety",
      "/news/beat/research",
      "/tools",
    ]);
  });

  it("leaves out beats with no published stories", () => {
    render(<BeatRow available={["products-launches", "research"]} />);
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual([
      "/news",
      "/news/beat/products-launches",
      "/news/beat/research",
      "/tools",
    ]);
  });

  it("shows every beat when availability is unknown", () => {
    render(<BeatRow available={null} />);
    expect(screen.getAllByRole("link")).toHaveLength(7);
  });

  it("marks the current beat, and only it", () => {
    render(<BeatRow />);
    const current = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual(["Research"]);
  });
});
