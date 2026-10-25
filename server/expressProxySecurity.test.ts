import { afterEach, describe, expect, it } from "vitest";
import { createServer, request, type Server } from "node:http";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { getSessionCookieOptions, toExpressCookieOptions } from "../backend/_core/cookies";

const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

function trustFor(subnets: string | string[]) {
  const app = express();
  app.set("trust proxy", subnets);
  // Exercise Express's own resolved proxy dependency, without adding a direct one.
  return app.get("trust proxy fn") as (address: string, hop: number) => boolean;
}

async function probe(
  app: Express,
  headers: Record<string, string> = {},
  body?: string,
) {
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.all("/fixture", (req, res) => {
    res.cookie("fixture_session", "synthetic-value", toExpressCookieOptions(getSessionCookieOptions(req)));
    res.json({
      ip: req.ip, ips: req.ips, protocol: req.protocol, hostname: req.hostname,
      body: req.body, cookies: req.cookies, query: req.query,
    });
  });
  const server = createServer(app);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected loopback fixture");
  // node:http connects directly to loopback and ignores environment HTTP proxies.
  return new Promise<{ status: number; body: Record<string, any>; cookies: string[] }>((resolve, reject) => {
    const req = request({
      hostname: "127.0.0.1", port: address.port, path: "/fixture?language=ar",
      method: body === undefined ? "GET" : "POST", headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("error", reject);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")), cookies: res.headers["set-cookie"] || [] });
        } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.setTimeout(3_000, () => req.destroy(new Error("Loopback fixture timeout")));
    req.end(body);
  });
}

describe("Express proxy and middleware compatibility", () => {
  it("keeps proxy trust disabled by default and ignores spoofed forwarding metadata", async () => {
    const app = express();
    expect(app.get("trust proxy")).toBe(false);
    const result = await probe(app, {
      "X-Forwarded-For": "203.0.113.18", "X-Forwarded-Proto": "https",
      "X-Forwarded-Host": "untrusted.fixture.test",
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ip: "127.0.0.1", ips: [], protocol: "http", hostname: "127.0.0.1" });
  });

  it("uses the socket peer when no forwarding header exists", async () => {
    const app = express();
    app.set("trust proxy", "loopback");
    expect((await probe(app)).body).toMatchObject({ ip: "127.0.0.1", ips: [], query: { language: "ar" } });
  });

  it("preserves client IP and HTTPS metadata through explicitly trusted fixture hops", async () => {
    const app = express();
    app.set("trust proxy", ["loopback", "192.0.2.0/24"]);
    const result = await probe(app, {
      "X-Forwarded-For": "203.0.113.18, 192.0.2.24",
      "X-Forwarded-Proto": "https", "X-Forwarded-Host": "trusted.fixture.test",
    });
    expect(result.body).toMatchObject({ ip: "203.0.113.18", ips: ["203.0.113.18", "192.0.2.24"], protocol: "https", hostname: "trusted.fixture.test" });
  });

  it("stops at the nearest untrusted hop", async () => {
    const app = express();
    app.set("trust proxy", "loopback");
    const result = await probe(app, { "X-Forwarded-For": "203.0.113.18, 192.0.2.24" });
    expect(result.body).toMatchObject({ ip: "192.0.2.24", ips: ["192.0.2.24"] });
  });

  it("preserves bilingual JSON, parsed cookies and existing session-cookie conversion", async () => {
    const payload = { message: "مرحبا / hello", amount: 123.45 };
    const result = await probe(express(), { "Content-Type": "application/json", Cookie: "fixture_existing=synthetic" }, JSON.stringify(payload));
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ body: payload, cookies: { fixture_existing: "synthetic" } });
    expect(result.cookies).toHaveLength(1);
    const cookie = result.cookies[0];
    const options = getSessionCookieOptions({ headers: {}, protocol: "http", hostname: "127.0.0.1" });
    expect(cookie).toContain(`Max-Age=${options.maxAge}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");
  });

  it("preserves extended form parsing", async () => {
    const form = new URLSearchParams({ "profile[name]": "مرحبا", "profile[language]": "ar" });
    const result = await probe(express(), { "Content-Type": "application/x-www-form-urlencoded" }, form.toString());
    expect(result.status).toBe(200);
    expect(result.body.body).toEqual({ profile: { name: "مرحبا", language: "ar" } });
  });

  it.each(["10.24.0.0/16", "::ffff:10.24.0.0/112"])("preserves the intended IPv4 block for %s", (subnet) => {
    const trust = trustFor(subnet);
    expect(trust("10.24.3.4", 0)).toBe(true);
    expect(trust("::ffff:10.24.3.4", 0)).toBe(true);
    expect(trust("10.25.3.4", 0)).toBe(false);
    expect(trust("203.0.113.18", 0)).toBe(false);
  });

  it("preserves ordinary native IPv6 subnet boundaries", () => {
    const trust = trustFor("fd42::/32");
    expect(trust("fd42::1234", 0)).toBe(true);
    expect(trust("fd43::1234", 0)).toBe(false);
    expect(trust("203.0.113.18", 0)).toBe(false);
  });

  it("preserves valid mixed-family subnet lists", () => {
    const trust = trustFor(["10.24.0.0/16", "fd42::/32"]);
    expect(trust("10.24.3.4", 0)).toBe(true);
    expect(trust("fd42::1234", 0)).toBe(true);
    expect(trust("203.0.113.18", 0)).toBe(false);
    expect(trust("fd43::1234", 0)).toBe(false);
  });
});

describe("proxy-addr trust-subnet security regression", () => {
  // Deliberately unsafe settings are confined to disposable fixture apps. The
  // application retains its existing default trust policy throughout this phase.
  it.each([
    ["short mapped prefix", "::ffff:10.24.0.0/16"],
    ["zero-leading IPv6 prefix", "::/1"],
    ["mixed subnet list", ["::ffff:10.24.0.0/16", "fd42::/32"]],
  ] as const)("does not trust arbitrary IPv4 peers through a %s", (_label, subnets) => {
    const trust = trustFor(typeof subnets === "string" ? subnets : [...subnets]);
    expect(trust("203.0.113.18", 0)).toBe(false);
    expect(trust("::ffff:203.0.113.18", 0)).toBe(false);
  });

  it.each(["::ffff:10.24.0.0/16", "::/1"])("rejects forwarded identity from an untrusted socket under %s", async (subnet) => {
    const app = express();
    app.set("trust proxy", subnet);
    const result = await probe(app, {
      "X-Forwarded-For": "203.0.113.18", "X-Forwarded-Proto": "https",
      "X-Forwarded-Host": "untrusted.fixture.test",
    });
    expect(result.body).toMatchObject({ ip: "127.0.0.1", ips: [], protocol: "http", hostname: "127.0.0.1" });
  });
});
