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
