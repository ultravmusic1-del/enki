import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchParamsOnMount } from "@/lib/use-search-params-on-mount";

describe("useSearchParamsOnMount", () => {
  afterEach(() => {
    // Reset the URL so an earlier test's query string can't leak into a
    // later one — history state is global and outlives `renderHook` cleanup.
    window.history.replaceState({}, "", "/");
  });

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

  it("starts false on the first render and flips true once the mount effect runs", () => {
    // This is the entire reason the hook returns a boolean instead of nothing:
    // a consumer's sync-to-URL effect must be able to see the "not yet read"
    // render and skip it. renderHook flushes effects before it returns, so
    // this has to be observed by recording every render, not by asserting on
    // the final `result.current`.
    window.history.replaceState({}, "", "/tools?q=x");
    const values: boolean[] = [];
    renderHook(() => {
      const ready = useSearchParamsOnMount(() => {});
      values.push(ready);
      return ready;
    });

    expect(values).toEqual([false, true]);
  });

  it("regression guard: does not re-run when the callback identity changes", () => {
    // With `[]` effect deps this is guaranteed regardless of how the callback
    // is stored internally. It exists to catch a future edit that adds
    // `apply` to the mount effect's dependency array (e.g. to silence
    // exhaustive-deps some other way) and reintroduces a re-run on every
    // render, since consumers pass a new inline arrow function each time.
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
