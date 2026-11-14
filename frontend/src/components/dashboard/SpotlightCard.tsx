import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

// Adapted from React Bits SpotlightCard, Copyright (c) 2026 David Haz.
// https://github.com/DavidHDev/react-bits — see /licenses/react-bits-LICENSE.md.
export default function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  return (
    <div
      ref={root}
      className={`dashboard-spotlight ${className}`}
      onPointerMove={event => {
        if (reducedMotion || event.pointerType !== "mouse") return;
        const element = root.current;
        if (!element) return;
        const rect = element.getBoundingClientRect();
        element.style.setProperty(
          "--spotlight-x",
          `${event.clientX - rect.left}px`
        );
        element.style.setProperty(
          "--spotlight-y",
          `${event.clientY - rect.top}px`
        );
      }}
    >
      {children}
    </div>
  );
}
