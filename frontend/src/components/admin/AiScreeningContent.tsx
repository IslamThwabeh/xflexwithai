import React from "react";

function renderEmphasis(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, index) =>
    index % 2 ? <strong key={index}>{part}</strong> : part,
  );
}

export function AiScreeningContent({ content }: { content: string }) {
  const lines = content.split(/\r\n|\r|\n/);
  // Model responses include applicant-controlled text. Keep formatting as React
  // elements so model output cannot introduce HTML, handlers or script URLs.
  return (
    <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none">
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {line.startsWith("### ")
            ? <strong>{renderEmphasis(line.slice(4))}</strong>
            : renderEmphasis(line)}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
}
