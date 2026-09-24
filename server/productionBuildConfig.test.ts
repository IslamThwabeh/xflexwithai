import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production frontend build configuration", () => {
  it("loads JSX source-location instrumentation only for the dev server", () => {
    const source = readFileSync("vite.config.ts", "utf8");
    expect(source).toContain('command === "serve" ? [jsxLocPlugin()] : []');
    expect(source).not.toContain("const plugins = [react(), tailwindcss(), jsxLocPlugin()]");
    expect(source).toContain("maxParallelFileOps: 2");
    expect(source).toContain("reportCompressedSize: false");
  });
});
