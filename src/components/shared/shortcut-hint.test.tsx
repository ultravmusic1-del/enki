import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ShortcutHint } from "@/components/shared/shortcut-hint";

function setPlatform(value: string) {
  Object.defineProperty(window.navigator, "platform", {
    value,
    configurable: true,
  });
}

afterEach(cleanup);

// These tests only check the rendered label per platform; they do not cover
// hydration safety. jsdom exposes `navigator` from the very first render, so
// if the component were "simplified" to read `navigator.platform` directly
// during render instead of inside the mount effect, every test here would
// still pass while the server/client markup mismatch it exists to prevent
// would be reintroduced. That guarantee depends on the effect-based pattern
// in shortcut-hint.tsx being preserved, not on anything asserted below.
describe("ShortcutHint", () => {
  it("shows the Ctrl form on Windows", () => {
    setPlatform("Win32");
    render(<ShortcutHint keyName="K" />);
    expect(screen.getByText("Ctrl K")).toBeInTheDocument();
  });

  it("shows the command form on a Mac", () => {
    setPlatform("MacIntel");
    render(<ShortcutHint keyName="K" />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("labels the shortcut for assistive tech", () => {
    setPlatform("Win32");
    render(<ShortcutHint keyName="K" />);
    expect(
      screen.getByLabelText("Keyboard shortcut: Control K"),
    ).toBeInTheDocument();
  });
});
