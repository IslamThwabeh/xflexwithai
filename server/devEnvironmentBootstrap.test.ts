import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const devBootstrap = readFileSync(
  new URL("../scripts/dev.ts", import.meta.url),
  "utf8",
);

describe("local development environment bootstrap", () => {
  it("loads .env before checking secrets or importing the server", () => {
    const dotenvLoad = devBootstrap.indexOf("config();");
    const jwtSecretCheck = devBootstrap.indexOf(
      "if (!process.env.JWT_SECRET?.trim())",
    );
    const serverImport = devBootstrap.indexOf(
      'await import("../backend/_core/index")',
    );

    expect(dotenvLoad).toBeGreaterThanOrEqual(0);
    expect(jwtSecretCheck).toBeGreaterThan(dotenvLoad);
    expect(serverImport).toBeGreaterThan(jwtSecretCheck);
  });
});
