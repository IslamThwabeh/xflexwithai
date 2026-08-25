import { describe, expect, it } from "vitest";
import {
  parseArticleContent,
  parseArticleInline,
  parseArticleSources,
  renderArticleContentHtml,
  renderArticleSourcesHtml,
} from "../shared/articleContent";

describe("article content formatting", () => {
  it("keeps existing paragraph-only articles backward compatible", () => {
    expect(parseArticleContent("First paragraph.\n\nSecond paragraph.")).toEqual([
      { type: "paragraph", content: [{ type: "text", value: "First paragraph." }] },
      { type: "paragraph", content: [{ type: "text", value: "Second paragraph." }] },
    ]);
  });

  it("builds semantic headings, lists, notes, and safe contextual links", () => {
    const content = [
      "## Risk basics",
      "Read the [risk disclosure](/en/risk-disclosure).",
      "### Before entering",
      "- Define the invalidation point",
      "- Read the [primary source](https://example.com/research)",
      "1. Set the risk limit",
      "2. Record the decision",
      "> Education does not guarantee profit.",
    ].join("\n");

    const blocks = parseArticleContent(content);
    expect(blocks.map((block) => block.type)).toEqual([
      "heading2",
      "paragraph",
      "heading3",
      "unorderedList",
      "orderedList",
      "blockquote",
    ]);

    const html = renderArticleContentHtml(content);
    expect(html).toContain("<h2>Risk basics</h2>");
    expect(html).toContain('<a href="/en/risk-disclosure">risk disclosure</a>');
    expect(html).toContain('<a href="https://example.com/research" target="_blank" rel="noopener noreferrer">primary source</a>');
    expect(html).toContain("<ul><li>Define the invalidation point</li>");
    expect(html).toContain("<ol><li>Set the risk limit</li><li>Record the decision</li></ol>");
  });

  it("does not turn unsafe or malformed link targets into anchors", () => {
    expect(parseArticleInline("[unsafe](javascript:alert)")).toEqual([
      { type: "text", value: "[unsafe](javascript:alert)" },
    ]);
    expect(renderArticleContentHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("supports labeled sources while preserving legacy URL-only lines", () => {
    const sources = [
      "Official guide | https://example.com/guide",
      "https://www.example.org/research",
      "Publication details pending review",
    ].join("\n");

    expect(parseArticleSources(sources)).toEqual([
      { label: "Official guide", href: "https://example.com/guide" },
      { label: "example.org", href: "https://www.example.org/research" },
      { label: "Publication details pending review", href: null },
    ]);
    expect(renderArticleSourcesHtml(sources)).toContain(
      '<a href="https://example.com/guide" target="_blank" rel="noopener noreferrer">Official guide</a>',
    );
  });
});
