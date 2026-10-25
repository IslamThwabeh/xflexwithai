import React from "react";
import { createRoot } from "react-dom/client";
import { Streamdown } from "streamdown";
import { AiScreeningContent } from "../../frontend/src/components/admin/AiScreeningContent";

const prose = `## ملخص / Summary

**Strong result** and **نتيجة جيدة**.

- First item
- العنصر الثاني

| Item | Value |
| --- | --- |
| Score | 85 |

[Documentation](https://example.invalid/docs)

\`\`\`js
const score = 85;
\`\`\``;

const diagrams = [
  'flowchart LR\n A["البداية / Start"] --> B["Done"]',
  'sequenceDiagram\n participant A as Student\n participant B as Staff\n A->>B: Review\n B-->>A: Done',
  'stateDiagram-v2\n [*] --> Review\n Review --> Approved\n Approved --> [*]',
];
const unsafeMarkdown = '<img src="/fixture-missing" onerror="window.fixtureProbe=1">\n\n[unsafe](javascript:window.fixtureProbe=1)\n\n<script>window.fixtureProbe=1</script>';

createRoot(document.getElementById("root")!).render(
  <>
    <section id="prose"><Streamdown mode="static" controls={false}>{prose}</Streamdown></section>
    <section id="diagrams">{diagrams.map((diagram, i) => (
      <Streamdown key={i} mode="static" controls={false}>{`\`\`\`mermaid\n${diagram}\n\`\`\``}</Streamdown>
    ))}</section>
    <section id="markdown-safety"><Streamdown mode="static" controls={false}>{unsafeMarkdown}</Streamdown></section>
    <section id="jobs"><AiScreeningContent content={"### التقييم / Screening\n**Good fit / مناسب**\nScore: 85/100\n\nUSD 123.45"} /></section>
    <section id="jobs-safety"><AiScreeningContent content={'<img src="/fixture-missing" onerror="window.fixtureProbe=1">'} /></section>
  </>,
);
