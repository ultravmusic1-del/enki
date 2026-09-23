import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StickySubscribeBar, barVisible } from "@/components/home/sticky-subscribe-bar";

type Callback = (entries: { target: Element; isIntersecting: boolean }[]) => void;
let observers: { cb: Callback; targets: Element[] }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      cb: Callback;
      targets: Element[] = [];
      constructor(cb: Callback) {
        this.cb = cb;
        observers.push(this);
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  document.body.innerHTML = '<section id="subscribe"></section><section data-subscribe-band></section>';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  try {
    sessionStorage.clear();
  } catch {}
});

function report(selector: string, isIntersecting: boolean) {
  const el = document.querySelector(selector)!;
  act(() => {
    for (const o of observers) if (o.targets.includes(el)) o.cb([{ target: el, isIntersecting }]);
  });
}

describe("barVisible", () => {
  it("shows only when the hero and bands are off screen and not dismissed", () => {
    expect(barVisible({ heroVisible: false, bandVisible: false, dismissed: false })).toBe(true);
    expect(barVisible({ heroVisible: true, bandVisible: false, dismissed: false })).toBe(false);
    expect(barVisible({ heroVisible: false, bandVisible: true, dismissed: false })).toBe(false);
    expect(barVisible({ heroVisible: false, bandVisible: false, dismissed: true })).toBe(false);
  });
});

describe("StickySubscribeBar", () => {
  it("appears once the hero scrolls away and hides over a band", () => {
    render(<StickySubscribeBar />);
    report("#subscribe", true);
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
    report("#subscribe", false);
    expect(screen.getByRole("region", { name: "Subscribe to Enki Daily" })).toBeTruthy();
    report("[data-subscribe-band]", true);
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
  });

  it("stays closed for the session after dismissal", () => {
    const { unmount } = render(<StickySubscribeBar />);
    report("#subscribe", false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
    unmount();
    render(<StickySubscribeBar />);
    report("#subscribe", false);
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
  });

  it("still works when sessionStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<StickySubscribeBar />);
    report("#subscribe", false);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Subscribe to Enki Daily" })).toBeNull();
  });
});
