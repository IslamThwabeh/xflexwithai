export type ArticleInlineToken =
  | { type: "text"; value: string }
  | { type: "link"; label: string; href: string; external: boolean };

export type ArticleContentBlock =
  | { type: "paragraph" | "heading2" | "heading3" | "blockquote"; content: ArticleInlineToken[] }
  | { type: "unorderedList" | "orderedList"; items: ArticleInlineToken[][] };

export type ArticleSource = {
  label: string;
  href: string | null;
};

const INLINE_LINK_PATTERN = /\[([^\]\r\n]+)\]\(([^)\s]+)\)/g;

function normalizeArticleHref(value: string) {
  const href = value.trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^\/(?!\/)/.test(href)) return href;
  if (/^#[A-Za-z][\w:.-]*$/.test(href)) return href;
  return null;
}

export function parseArticleInline(value: string): ArticleInlineToken[] {
  const tokens: ArticleInlineToken[] = [];
  let cursor = 0;

  for (const match of value.matchAll(INLINE_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ type: "text", value: value.slice(cursor, index) });

    const href = normalizeArticleHref(match[2]);
    if (href) {
      tokens.push({
        type: "link",
        label: match[1].trim(),
        href,
        external: /^https?:\/\//i.test(href),
      });
    } else {
      tokens.push({ type: "text", value: match[0] });
    }
    cursor = index + match[0].length;
  }

  if (cursor < value.length) tokens.push({ type: "text", value: value.slice(cursor) });
  return tokens.length > 0 ? tokens : [{ type: "text", value }];
}

function isStructuralLine(line: string) {
  return /^(#{2,3}|[-*]|\d+\.|>)\s+/.test(line.trim());
}

export function parseArticleContent(content?: string | null): ArticleContentBlock[] {
  const lines = (content ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ArticleContentBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading3 = line.match(/^###\s+(.+)$/);
    if (heading3) {
      blocks.push({ type: "heading3", content: parseArticleInline(heading3[1]) });
      index += 1;
      continue;
    }

    const heading2 = line.match(/^##\s+(.+)$/);
    if (heading2) {
      blocks.push({ type: "heading2", content: parseArticleInline(heading2[1]) });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: ArticleInlineToken[][] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!item) break;
        items.push(parseArticleInline(item[1]));
        index += 1;
      }
      blocks.push({ type: "unorderedList", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ArticleInlineToken[][] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^\d+\.\s+(.+)$/);
        if (!item) break;
        items.push(parseArticleInline(item[1]));
        index += 1;
      }
      blocks.push({ type: "orderedList", items });
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quote = lines[index].trim().match(/^>\s+(.+)$/);
        if (!quote) break;
        quoteLines.push(quote[1]);
        index += 1;
      }
      blocks.push({ type: "blockquote", content: parseArticleInline(quoteLines.join(" ")) });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index].trim();
      if (!nextLine || isStructuralLine(nextLine)) break;
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", content: parseArticleInline(paragraphLines.join(" ")) });
  }

  return blocks;
}

export function parseArticleSources(sources?: string | null): ArticleSource[] {
  return (sources ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const labeled = line.match(/^(.+?)\s*\|\s*(https?:\/\/\S+)$/i);
      if (labeled) return { label: labeled[1].trim(), href: labeled[2] };
      if (/^https?:\/\/\S+$/i.test(line)) {
        try {
          const hostname = new URL(line).hostname.replace(/^www\./i, "");
          return { label: hostname || line, href: line };
        } catch {
          return { label: line, href: null };
        }
      }
      return { label: line, href: null };
    });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineHtml(tokens: ArticleInlineToken[]) {
  return tokens.map((token) => {
    if (token.type === "text") return escapeHtml(token.value);
    const attributes = token.external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(token.href)}"${attributes}>${escapeHtml(token.label)}</a>`;
  }).join("");
}

export function renderArticleContentHtml(content?: string | null) {
  return parseArticleContent(content).map((block) => {
    if (block.type === "heading2") return `<h2>${renderInlineHtml(block.content)}</h2>`;
    if (block.type === "heading3") return `<h3>${renderInlineHtml(block.content)}</h3>`;
    if (block.type === "blockquote") return `<blockquote>${renderInlineHtml(block.content)}</blockquote>`;
    if (block.type === "unorderedList" || block.type === "orderedList") {
      const tag = block.type === "unorderedList" ? "ul" : "ol";
      return `<${tag}>${block.items.map((item) => `<li>${renderInlineHtml(item)}</li>`).join("")}</${tag}>`;
    }
    if (block.type === "paragraph") return `<p>${renderInlineHtml(block.content)}</p>`;
    return "";
  }).join("");
}

export function renderArticleSourcesHtml(sources?: string | null) {
  return parseArticleSources(sources).map((source) => {
    const label = escapeHtml(source.label);
    return source.href
      ? `<li><a href="${escapeHtml(source.href)}" target="_blank" rel="noopener noreferrer">${label}</a></li>`
      : `<li>${label}</li>`;
  }).join("");
}
