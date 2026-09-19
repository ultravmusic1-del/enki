import { describe, it, expect } from "vitest";
import { cleanText, FeedParseError, parseFeed } from "@/lib/news/parse-feed";

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Example AI</title>
    <item>
      <title><![CDATA[Cursor raises $900M & ships agents]]></title>
      <link>https://example.com/cursor-raise</link>
      <description>&lt;p&gt;The editor&amp;nbsp;maker&lt;/p&gt; grew fast.</description>
      <pubDate>Fri, 19 Sep 2026 09:00:00 GMT</pubDate>
      <enclosure url="https://cdn.example.com/cursor.jpg" type="image/jpeg" length="1"/>
    </item>
    <item>
      <title>Media image wins over body image</title>
      <link>https://example.com/two</link>
      <media:content url="https://cdn.example.com/media.jpg" medium="image"/>
      <content:encoded><![CDATA[<p><img src="https://cdn.example.com/body.jpg"></p><p>Body</p>]]></content:encoded>
    </item>
    <item>
      <title>Body image as a fallback</title>
      <link>https://example.com/three</link>
      <content:encoded><![CDATA[<img src="https://cdn.example.com/body.jpg"> Text]]></content:encoded>
    </item>
    <item>
      <title>Plain http image is dropped</title>
      <link>https://example.com/four</link>
      <enclosure url="http://cdn.example.com/insecure.jpg" type="image/jpeg"/>
      <pubDate>not a date</pubDate>
    </item>
    <item>
      <title>No link</title>
    </item>
    <item>
      <title>Script link</title>
      <link>javascript:alert(1)</link>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Lab blog</title>
  <entry>
    <title type="html">Gemini &amp;amp; friends</title>
    <link rel="self" href="https://lab.example.com/feed/1"/>
    <link rel="alternate" type="text/html" href="https://lab.example.com/posts/1"/>
    <summary>Short summary.</summary>
    <published>2026-09-18T10:00:00Z</published>
    <media:thumbnail url="https://lab.example.com/thumb.png"/>
  </entry>
  <entry>
    <title>Updated only</title>
    <link href="https://lab.example.com/posts/2"/>
    <content type="html">&lt;b&gt;Content&lt;/b&gt; body</content>
    <updated>2026-09-17T08:00:00Z</updated>
  </entry>
</feed>`;

const rdf = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel><title>RDF</title></channel>
  <item>
    <title>RDF story</title>
    <link>https://rdf.example.com/1</link>
    <description>Desc</description>
    <dc:date>2026-09-18T07:00:00Z</dc:date>
  </item>
</rdf:RDF>`;

describe("parseFeed: RSS 2.0", () => {
  const items = parseFeed(rss);

  it("keeps items with an http(s) link and skips the rest", () => {
    expect(items.map((i) => i.url)).toEqual([
      "https://example.com/cursor-raise",
      "https://example.com/two",
      "https://example.com/three",
      "https://example.com/four",
    ]);
  });

  it("reads CDATA titles", () => {
    expect(items[0].title).toBe("Cursor raises $900M & ships agents");
  });

  it("strips HTML from the excerpt", () => {
    expect(items[0].excerpt).toBe("The editor maker grew fast.");
  });

  it("parses the publish date", () => {
    expect(items[0].publishedAt?.toISOString()).toBe("2026-09-19T09:00:00.000Z");
  });

  it("reads images from the enclosure, then media tags, then the body", () => {
    expect(items[0].imageUrl).toBe("https://cdn.example.com/cursor.jpg");
    expect(items[1].imageUrl).toBe("https://cdn.example.com/media.jpg");
    expect(items[2].imageUrl).toBe("https://cdn.example.com/body.jpg");
  });

  it("drops non-https images and invalid dates", () => {
    expect(items[3].imageUrl).toBeNull();
    expect(items[3].publishedAt).toBeNull();
  });
});

describe("parseFeed: Atom", () => {
  const items = parseFeed(atom);

  it("prefers the alternate link over rel=self", () => {
    expect(items[0].url).toBe("https://lab.example.com/posts/1");
  });

  it("uses a link without rel as the alternate", () => {
    expect(items[1].url).toBe("https://lab.example.com/posts/2");
  });

  it("decodes an html-typed title", () => {
    expect(items[0].title).toBe("Gemini & friends");
  });

  it("falls back from summary to content and from published to updated", () => {
    expect(items[1].excerpt).toBe("Content body");
    expect(items[1].publishedAt?.toISOString()).toBe("2026-09-17T08:00:00.000Z");
  });

  it("reads media:thumbnail", () => {
    expect(items[0].imageUrl).toBe("https://lab.example.com/thumb.png");
  });
});

describe("parseFeed: RSS 1.0 (RDF)", () => {
  it("reads items and dc:date", () => {
    const [item] = parseFeed(rdf);
    expect(item.title).toBe("RDF story");
    expect(item.publishedAt?.toISOString()).toBe("2026-09-18T07:00:00.000Z");
  });
});

describe("parseFeed: bad input", () => {
  it("throws FeedParseError on a document that is not a feed", () => {
    expect(() => parseFeed("<html><body>Not a feed</body></html>")).toThrow(FeedParseError);
  });

  it("truncates a long excerpt to 1000 characters", () => {
    const long = rss.replace("grew fast.", "a".repeat(5000));
    expect(parseFeed(long)[0].excerpt?.length).toBeLessThanOrEqual(1000);
  });
});

describe("cleanText", () => {
  it("decodes numeric and named entities and collapses whitespace", () => {
    expect(cleanText("A&#8217;s &mdash;\n\n  B&#x2019;s")).toBe("A’s — B’s");
  });
});
