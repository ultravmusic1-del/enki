import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StoryViewPing } from "@/components/news/story-view-ping";

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StoryViewPing", () => {
  it("records a view once per story per browser session", () => {
    const first = render(<StoryViewPing storyId="story-a" />);
    first.unmount();
    render(<StoryViewPing storyId="story-a" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/story-view",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ storyId: "story-a" }) }),
    );
  });

  it("counts a different story separately", () => {
    render(<StoryViewPing storyId="story-a" />);
    render(<StoryViewPing storyId="story-b" />);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still records the view when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<StoryViewPing storyId="story-a" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders nothing", () => {
    const { container } = render(<StoryViewPing storyId="story-a" />);
    expect(container.innerHTML).toBe("");
  });
});
