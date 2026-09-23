import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { QueueStory } from "@/app/admin/news/types";

const mergeStory = vi.fn();
vi.mock("@/app/admin/news/actions", () => ({ mergeStory: (...a: unknown[]) => mergeStory(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { RejectedStory } = await import("@/app/admin/news/rejected-story");

const STORY: QueueStory = {
  id: "11111111-1111-4111-8111-111111111111",
  headline: "A duplicate",
  sourceName: "The Verge",
  sourceUrl: "https://www.theverge.com/a",
  sources: [],
  imageUrl: null,
  excerpt: "What the publisher said.",
  summary: "",
  body: "",
  beat: "",
  featured: false,
  slug: null,
  age: "2d ago",
  toolSlugs: [],
};
const TARGET = { id: "22222222-2222-4222-8222-222222222222", headline: "Published: The story" };

describe("RejectedStory", () => {
  afterEach(() => {
    cleanup();
    mergeStory.mockReset();
  });

  it("shows the excerpt and a plain link to the source, with no publish controls", () => {
    render(<RejectedStory story={STORY} mergeTargets={[TARGET]} />);
    expect(screen.getByText("What the publisher said.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "The Verge" });
    expect(link.getAttribute("href")).toBe("https://www.theverge.com/a");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
  });

  it("merges into the picked story, and only once one is picked", async () => {
    mergeStory.mockResolvedValue({ ok: true });
    render(<RejectedStory story={STORY} mergeTargets={[TARGET]} />);
    const button = screen.getByRole("button", { name: "Merge" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByRole("combobox", { name: "Merge into" }), { target: { value: TARGET.id } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(mergeStory).toHaveBeenCalledWith(STORY.id, TARGET.id));
  });

  it("says so when there is nothing to merge into", () => {
    render(<RejectedStory story={STORY} mergeTargets={[]} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(/nothing to merge into/i)).toBeTruthy();
  });
});
