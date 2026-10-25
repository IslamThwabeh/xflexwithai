import net from "node:net";
import { describe, expect, it } from "vitest";
import { getDevServerHost, getServerListenHost } from "../shared/devServerHost";

describe("development listener policy", () => {
  it("binds a default development listener only to IPv4 loopback", async () => {
    const server = net.createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen({ port: 0, host: getServerListenHost("development") }, resolve);
      });
      expect(server.address()).toMatchObject({ address: "127.0.0.1", family: "IPv4" });
    } finally {
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("requires explicit opt-in for LAN access", () => {
    expect(getDevServerHost("   ")).toBe("127.0.0.1");
    expect(getServerListenHost("development", " 0.0.0.0 ")).toBe("0.0.0.0");
    expect(getDevServerHost("192.168.1.10")).toBe("192.168.1.10");
  });

  it("preserves the existing production listener regardless of the development override", () => {
    expect(getServerListenHost("production", "127.0.0.1")).toBeUndefined();
    expect(getServerListenHost(undefined)).toBeUndefined();
  });
});
