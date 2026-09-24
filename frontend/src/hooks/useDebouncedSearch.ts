import { useEffect, useState } from "react";

export function useDebouncedSearch(value: string, delayMs = 400, minimumLength = 2) {
  const [debouncedValue, setDebouncedValue] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = value.trim();
      setDebouncedValue(normalized.length >= minimumLength ? normalized : "");
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, minimumLength, value]);

  return debouncedValue;
}
