import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AiScreeningContent } from "../frontend/src/components/admin/AiScreeningContent";

const render = (content: string) => renderToStaticMarkup(createElement(AiScreeningContent, { content }));

describe("AI screening formatting compatibility", () => {
  it("preserves ordinary English text", () => expect(render("Candidate summary: good fit.")).toContain("Candidate summary: good fit."));
  it("preserves Arabic text and scores", () => expect(render("التقييم: 85/100 — مناسب")).toContain("التقييم: 85/100 — مناسب"));
  it("preserves bold emphasis", () => expect(render("A **good fit** for the role.")).toContain("<strong>good fit</strong>"));
  it("preserves heading emphasis", () => expect(render("### Summary")).toContain("<strong>Summary"));
  it("preserves line breaks", () => expect(render("One\nTwo").match(/<br\s*\/?\s*>/g)).toHaveLength(1));
  it("preserves blank lines", () => expect(render("One\n\nTwo").match(/<br\s*\/?\s*>/g)).toHaveLength(2));
  it("preserves Arabic emphasis", () => expect(render("المتقدم **مناسب** للوظيفة")).toContain("<strong>مناسب</strong>"));
  it("preserves numeric and currency text", () => expect(render("USD 123.45 / ILS 456.78")).toContain("USD 123.45 / ILS 456.78"));
});

describe("AI screening treats model output as text", () => {
  it.each([
    ['image event handler', '<img src="/fixture-missing" onerror="window.fixtureProbe=1">', 'img'],
    ['script element', '<script>window.fixtureProbe=1</script>', 'script'],
    ['SVG event handler', '<svg onload="window.fixtureProbe=1"></svg>', 'svg'],
    ['embedded document', '<iframe srcdoc="fixture"></iframe>', 'iframe'],
    ['style injection', '<style>body{display:none}</style>', 'style'],
    ['script link', '<a href="javascript:window.fixtureProbe=1">link</a>', 'a'],
  ])("escapes %s while keeping its text visible", (_label, input, tag) => {
    const markup = render(input);
    expect(markup).not.toMatch(new RegExp(`<${tag}\\b`, "i"));
    expect(markup).toContain(`&lt;${tag}`);
  });
});
