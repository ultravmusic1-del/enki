import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StoryImage } from "@/components/front-page/story-image";

describe("StoryImage", () => {
  afterEach(cleanup);

  it("renders the image in a 16:9 frame by default", () => {
    const { container } = render(<StoryImage src="https://cdn.example.com/a.jpg" />);
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.className).toContain("aspect-video");
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.example.com/a.jpg");
    expect(img.className).toContain("object-cover");
  });

  it("anchors the crop above centre so subjects stay in frame", () => {
    const { container } = render(<StoryImage src="https://cdn.example.com/a.jpg" />);
    expect(container.querySelector("img")!.className).toContain("object-[50%_35%]");
  });

  it("shows a designed placeholder, not an empty box, when there is no image", () => {
    const { container, getByText } = render(<StoryImage src={null} label="Research" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[data-story-image-placeholder]")).not.toBeNull();
    expect(getByText("Research")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-video");
  });

  it("keeps the placeholder decorative for screen readers", () => {
    const { container } = render(<StoryImage src={null} label="Research" />);
    expect(container.querySelector("[data-story-image-placeholder]")!.getAttribute("aria-hidden")).toBe("true");
  });
});
