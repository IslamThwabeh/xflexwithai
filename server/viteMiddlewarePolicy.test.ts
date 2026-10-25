import { createServer } from "node:http";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vite")>();
  return { ...actual, createServer: vi.fn() };
});

import { createServer as createViteServer } from "vite";
import { setupVite } from "../backend/_core/vite";

describe("Vite middleware security policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createViteServer).mockResolvedValue({ middlewares: vi.fn() } as never);
  });

  it("passes filesystem restrictions and the hostname allowlist into middleware mode", async () => {
    const app = { use: vi.fn() } as unknown as Express;
    const server = createServer();
    await setupVite(app, server);

    const options = vi.mocked(createViteServer).mock.calls[0][0];
    expect(options?.server).toMatchObject({
      middlewareMode: true,
      hmr: { server },
      fs: { strict: true, deny: ["**/.*"] },
    });
    expect(options?.server?.allowedHosts).toEqual(expect.arrayContaining(["localhost", "127.0.0.1"]));
    expect(options?.server?.allowedHosts).not.toBe(true);
    expect(app.use).toHaveBeenCalledTimes(2);
  });
});
