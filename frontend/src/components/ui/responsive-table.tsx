import { useRef, useLayoutEffect } from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps a shadcn <Table> in a card-stacked layout.
 * Automatically reads <thead th> text and injects it as data-label on each <td>
 * so the CSS can show the column name above each cell value.
 * Re-runs on every render, so language changes are reflected instantly.
 */
export function ResponsiveTable({ children, className = '' }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const headers = Array.from(el.querySelectorAll('thead th')).map(
      (th) => (th as HTMLElement).innerText.trim()
    );
    el.querySelectorAll('tbody tr').forEach((row) => {
      (row.querySelectorAll('td') as NodeListOf<HTMLElement>).forEach((cell, i) => {
        cell.dataset.label = headers[i] ?? '';
      });
    });
  });

  return (
    <div ref={wrapperRef} className={`stacked-table${className ? ' ' + className : ''}`}>
      {children}
    </div>
  );
}
