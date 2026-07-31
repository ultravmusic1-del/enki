import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchParamsOnMount } from "@/lib/use-search-params-on-mount";

describe("useSearchParamsOnMount", () => {
  it("passes the current query string to the callback once", () => {
    window.history.replaceState({}, "", "/tools?q=cursor&cat=coding");
    const apply = vi.fn();
    renderHook(() => useSearchParamsOnMount(apply));

    expect(apply).toHaveBeenCalledTimes(1);
    const params = apply.mock.calls[0][0] as URLSearchParams;
    expect(params.get("q")).toBe("cursor");
    expect(params.get("cat")).toBe("coding");
  });

  it("still reports ready when there is no query string", () => {
    window.history.replaceState({}, "", "/tools");
    const apply = vi.fn();
    const { result } = renderHook(() => useSearchParamsOnMount(apply));

    expect(apply).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });

  it("does not re-run when the callback identity changes", () => {
    window.history.replaceState({}, "", "/tools?q=a");
    const first = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useSearchParamsOnMount(cb),
      { initialProps: { cb: first } },
    );
    const second = vi.fn();
    act(() => rerender({ cb: second }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
