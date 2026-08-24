import { describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "../frontend/src/lib/copyText";

describe("support chat clipboard behavior", () => {
  it("uses the modern Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyTextToClipboard("رسالة للدعم", {
      clipboard: { writeText },
      document: null,
    })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("رسالة للدعم");
  });

  it("uses the synchronous selection path before a standalone app can reject the Clipboard API", async () => {
    const textarea = {
      value: "",
      readOnly: false,
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
      remove: vi.fn(),
    };
    const appendChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const fakeDocument = {
      body: { appendChild },
      activeElement: null,
      createElement: vi.fn().mockReturnValue(textarea),
      execCommand,
    } as unknown as Document;

    await expect(copyTextToClipboard("fallback message", {
      clipboard: { writeText },
      document: fakeDocument,
    })).resolves.toBe(true);
    expect(textarea.value).toBe("fallback message");
    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(textarea.select).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(textarea.remove).toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("uses the modern Clipboard API when the synchronous browser command is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fakeDocument = {
      body: {},
      execCommand: undefined,
    } as unknown as Document;

    await expect(copyTextToClipboard("modern fallback", {
      clipboard: { writeText },
      document: fakeDocument,
    })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("modern fallback");
  });
});
