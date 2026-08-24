type ClipboardWriter = {
  writeText: (text: string) => Promise<void>;
};

type CopyTextOptions = {
  clipboard?: ClipboardWriter | null;
  document?: Document | null;
};

/**
 * Copy text in modern browsers and in older/in-app mobile browsers where the
 * async Clipboard API is unavailable or denied.
 */
export async function copyTextToClipboard(
  text: string,
  options: CopyTextOptions = {},
): Promise<boolean> {
  const clipboard = options.clipboard === undefined
    ? (typeof navigator !== "undefined" ? navigator.clipboard : null)
    : options.clipboard;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Some iOS and in-app browsers expose the API but reject the call.
      // Continue to the selection-based fallback below.
    }
  }

  const doc = options.document === undefined
    ? (typeof document !== "undefined" ? document : null)
    : options.document;
  if (!doc?.body || typeof doc.execCommand !== "function") return false;

  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  const previousFocus = doc.activeElement && typeof (doc.activeElement as HTMLElement).focus === "function"
    ? doc.activeElement as HTMLElement
    : null;
  doc.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}
