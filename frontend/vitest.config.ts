import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "path";

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
