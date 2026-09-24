import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const config = vi.hoisted(() => ({
  NEWSLETTER: {
    name: "Enki Daily",
    hostedUrl: "",
    forms: {
      home: { src: "", height: 56, mobileHeight: 112 },
      story: { src: "", height: 56, mobileHeight: 112 },
      footer: { src: "", height: 56, mobileHeight: 112 },
    },
  },
}));
vi.mock("@/lib/newsletter", () => config);

const { BeehiivEmbed } = await import("@/components/newsletter/beehiiv-embed");

describe("BeehiivEmbed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    config.NEWSLETTER.forms.home.src = "";
    config.NEWSLETTER.hostedUrl = "";
  });

  it("says signups open soon when neither the form nor the hosted page exists", () => {
    render(<BeehiivEmbed form="home" />);
    expect(screen.getByText("Signups open soon.")).toBeTruthy();
    expect(screen.queryByTitle("Subscribe to Enki Daily")).toBeNull();
  });

  it("links to the hosted page when the form is not configured", () => {
    config.NEWSLETTER.hostedUrl = "https://enkidaily.beehiiv.com/subscribe";
    render(<BeehiivEmbed form="home" />);
    expect(screen.getByRole("link", { name: /Subscribe to Enki Daily/ }).getAttribute("href")).toBe(
      "https://enkidaily.beehiiv.com/subscribe",
    );
  });

  it("renders a titled iframe with a skeleton, lazily when asked", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    render(<BeehiivEmbed form="home" lazy />);
    const frame = screen.getByTitle("Subscribe to Enki Daily");
    expect(frame.getAttribute("src")).toBe("https://subscribe-forms.beehiiv.com/abc");
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(screen.getByTestId("embed-skeleton")).toBeTruthy();
  });

  it("sets the iframe src only after mount, so the onLoad listener is always attached first", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    render(<BeehiivEmbed form="home" />);
    // After render (and its effects) flush, src is set: a real browser
    // cannot have started (or finished) the request before this point.
    const frame = screen.getByTitle("Subscribe to Enki Daily");
    expect(frame.getAttribute("src")).toBe("https://subscribe-forms.beehiiv.com/abc");
  });

  it("hides the skeleton once the iframe loads", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    render(<BeehiivEmbed form="home" />);
    act(() => {
      screen.getByTitle("Subscribe to Enki Daily").dispatchEvent(new Event("load"));
    });
    expect(screen.queryByTestId("embed-skeleton")).toBeNull();
  });

  it("shows the fallback if the iframe has not loaded after 8 seconds", () => {
    config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
    config.NEWSLETTER.hostedUrl = "https://enkidaily.beehiiv.com/subscribe";
    render(<BeehiivEmbed form="home" />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByRole("link", { name: /Subscribe to Enki Daily/ })).toBeTruthy();
  });

  describe("lazy embeds", () => {
    let intersectionCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

    class MockIntersectionObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersectionCallback = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    beforeEach(() => {
      intersectionCallback = null;
      vi.stubGlobal("IntersectionObserver", MockIntersectionObserver as unknown as typeof IntersectionObserver);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("does not show the fallback after 8 seconds while not intersecting", () => {
      config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
      config.NEWSLETTER.hostedUrl = "https://enkidaily.beehiiv.com/subscribe";
      render(<BeehiivEmbed form="home" lazy />);
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByTitle("Subscribe to Enki Daily")).toBeTruthy();
      expect(screen.queryByRole("link", { name: /Subscribe to Enki Daily/ })).toBeNull();
    });

    it("shows the fallback 8 seconds after intersecting the viewport", () => {
      config.NEWSLETTER.forms.home.src = "https://subscribe-forms.beehiiv.com/abc";
      config.NEWSLETTER.hostedUrl = "https://enkidaily.beehiiv.com/subscribe";
      render(<BeehiivEmbed form="home" lazy />);
      act(() => {
        intersectionCallback?.([{ isIntersecting: true }]);
      });
      act(() => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByRole("link", { name: /Subscribe to Enki Daily/ })).toBeTruthy();
    });
  });
});
