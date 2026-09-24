import { describe, it, expect, vi } from "vitest";
import { extractOgImage, fetchOgImage, OG_MAX_BYTES } from "@/lib/news/og-image";

const PAGE = "https://techcrunch.com/2026/09/18/a-story/";

describe("extractOgImage", () => {
  it("reads property=og:image", () => {
    expect(extractOgImage('<head><meta property="og:image" content="https://cdn.example.com/a.jpg" /></head>', PAGE)).toBe(
      "https://cdn.example.com/a.jpg",
    );
  });

  it("accepts content before property, single quotes and name=", () => {
    expect(extractOgImage("<meta content='https://cdn.example.com/b.jpg' property='og:image'>", PAGE)).toBe(
      "https://cdn.example.com/b.jpg",
    );
    expect(extractOgImage('<meta name="og:image" content="https://cdn.example.com/c.jpg">', PAGE)).toBe(
      "https://cdn.example.com/c.jpg",
    );
  });

  it("decodes entities in the URL", () => {
    expect(extractOgImage('<meta property="og:image" content="https://cdn.example.com/d.jpg?w=1200&amp;h=675">', PAGE)).toBe(
      "https://cdn.example.com/d.jpg?w=1200&h=675",
    );
  });

  it("resolves a relative URL against the page", () => {
    expect(extractOgImage('<meta property="og:image" content="/img/e.jpg">', PAGE)).toBe("https://techcrunch.com/img/e.jpg");
  });

  it("prefers og:image:secure_url, then og:image, then twitter:image", () => {
    expect(
      extractOgImage(
        '<meta name="twitter:image" content="https://t.example.com/t.jpg"><meta property="og:image" content="https://o.example.com/o.jpg"><meta property="og:image:secure_url" content="https://s.example.com/s.jpg">',
        PAGE,
      ),
    ).toBe("https://s.example.com/s.jpg");
    expect(extractOgImage('<meta name="twitter:image" content="https://t.example.com/t.jpg">', PAGE)).toBe(
      "https://t.example.com/t.jpg",
    );
  });

  it("rejects non-https and script URLs", () => {
    expect(extractOgImage('<meta property="og:image" content="http://cdn.example.com/f.jpg">', PAGE)).toBeNull();
    expect(extractOgImage('<meta property="og:image" content="javascript:alert(1)">', PAGE)).toBeNull();
    expect(extractOgImage('<meta property="og:image" content="data:image/png;base64,AAAA">', PAGE)).toBeNull();
  });

  it("returns null when there is no image meta", () => {
    expect(extractOgImage("<html><head><title>x</title></head></html>", PAGE)).toBeNull();
  });
});

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
}

describe("fetchOgImage", () => {
  it("fetches the page and returns its og:image", async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('<meta property="og:image" content="https://cdn.example.com/a.jpg">'));
    expect(await fetchOgImage(PAGE, fetchImpl as unknown as typeof fetch)).toBe("https://cdn.example.com/a.jpg");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String((init.headers as Record<string, string>)["user-agent"])).toMatch(/^EnkiNewsBot\/1\.0 /);
    expect(init.signal).toBeDefined();
  });

  it("resolves null on a non-2xx response, a non-HTML response and a thrown error", async () => {
    expect(await fetchOgImage(PAGE, (async () => htmlResponse("", { status: 404 })) as unknown as typeof fetch)).toBeNull();
    expect(
      await fetchOgImage(
        PAGE,
        (async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch,
      ),
    ).toBeNull();
    expect(await fetchOgImage(PAGE, (async () => { throw new Error("boom"); }) as unknown as typeof fetch)).toBeNull();
  });

  it("stops reading after OG_MAX_BYTES", async () => {
    const chunk = new TextEncoder().encode("x".repeat(64_000));
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += chunk.length;
        if (pulled > OG_MAX_BYTES * 3) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const fetchImpl = (async () => new Response(stream, { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    expect(await fetchOgImage(PAGE, fetchImpl)).toBeNull();
    expect(pulled).toBeLessThanOrEqual(OG_MAX_BYTES + 2 * chunk.length);
  });

  it("rejects a non-https page URL without fetching", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchOgImage("http://example.com/a", fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});


describe("fetchOgImage redirects", () => {
  const redirect = (location: string) => new Response(null, { status: 301, headers: { location } });
  const page = (html: string) => htmlResponse(html);
  const og = '<meta property="og:image" content="https://cdn.example.com/r.jpg">';

  function sequence(...responses: Response[]) {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(url);
      expect(init?.redirect).toBe("manual");
      return responses[calls.length - 1];
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }

  it("follows up to 3 https redirects and resolves against the final URL", async () => {
    const { fetchImpl, calls } = sequence(redirect("https://techcrunch.com/b"), redirect("/c"), page(og));
    expect(await fetchOgImage(PAGE, fetchImpl)).toBe("https://cdn.example.com/r.jpg");
    expect(calls).toEqual([PAGE, "https://techcrunch.com/b", "https://techcrunch.com/c"]);
  });

  it("refuses a redirect to http, localhost or an IP address", async () => {
    for (const target of ["http://techcrunch.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://169.254.169.254/latest", "https://[::1]/x"]) {
      const { fetchImpl, calls } = sequence(redirect(target), page(og));
      expect(await fetchOgImage(PAGE, fetchImpl), target).toBeNull();
      expect(calls, target).toHaveLength(1);
    }
  });

  it("gives up after 3 redirects", async () => {
    const { fetchImpl } = sequence(redirect("https://a.example/1"), redirect("https://a.example/2"), redirect("https://a.example/3"), redirect("https://a.example/4"), page(og));
    expect(await fetchOgImage(PAGE, fetchImpl)).toBeNull();
  });

  it("refuses a starting URL on localhost or an IP address", async () => {
    const fetchImpl = vi.fn();
    expect(await fetchOgImage("https://10.0.0.5/story", fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(await fetchOgImage("https://localhost/story", fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
