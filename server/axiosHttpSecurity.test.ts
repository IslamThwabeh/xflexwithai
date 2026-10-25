import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import axios from "axios";
import { AXIOS_TIMEOUT_MS } from "../shared/const";

const servers: Server[] = [];
const timers: ReturnType<typeof setTimeout>[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const timer of timers.splice(0)) clearTimeout(timer);
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function listen(handler?: (request: IncomingMessage, response: ServerResponse) => void | Promise<void>) {
  const server = createServer((request, response) => {
    void (async () => {
      if (handler) return handler(request, response);
      if (request.url === "/redirect") {
        response.writeHead(307, { Location: "/echo" });
        response.end();
        return;
      }
      if (request.url === "/slow") {
        timers.push(setTimeout(() => { if (!response.destroyed) response.end("delayed"); }, 150));
        return;
      }
      if (request.url === "/payload") {
        response.end("x".repeat(64));
        return;
      }
      if (request.url === "/error") {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "invalid fixture request" }));
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({
        method: request.method, path: request.url, headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    })().catch(() => response.destroy());
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a loopback TCP fixture");
  const origin = `http://127.0.0.1:${address.port}`;
  // proxy:false is test-only, ensuring inherited machine proxy settings never
  // send a fixture request outside loopback. Application defaults are unchanged.
  return { origin, client: axios.create({ baseURL: origin, timeout: AXIOS_TIMEOUT_MS, adapter: "http", proxy: false }) };
}

async function readStream(url: string, maximum: number) {
  const response = await axios.get<Readable>(url, {
    adapter: "http", proxy: false, responseType: "stream", maxContentLength: maximum,
  });
  const chunks: Buffer[] = [];
  for await (const chunk of response.data) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function useFixtureProxy(origin: string, noProxy = "") {
  for (const key of ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy", "NO_PROXY", "no_proxy"]) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("HTTP_PROXY", origin);
  vi.stubEnv("NO_PROXY", noProxy);
}

describe("Axios HTTP request compatibility", () => {
  it("preserves the legacy helper's relative JSON POST pattern and configured timeout", async () => {
    const { client } = await listen();
    const payload = { clientId: "fixture-app", code: "fixture-code", redirectUri: "/مرحبا" };
    const response = await client.post("/webdev.v1.WebDevAuthPublicService/ExchangeToken", payload, {
      headers: { Authorization: "Bearer fixture-token", "X-Fixture": "test" },
    });
    expect(client.defaults.timeout).toBe(30_000);
    expect(response.data).toMatchObject({
      method: "POST", path: "/webdev.v1.WebDevAuthPublicService/ExchangeToken",
      headers: { authorization: "Bearer fixture-token", "x-fixture": "test" },
    });
    expect(JSON.parse(response.data.body)).toEqual(payload);
    expect(response.data.headers["content-type"]).toMatch(/application\/json/);
  });

  it("preserves GET defaults and encodes query values", async () => {
    const { client, origin } = await listen();
    const response = await client.request({ url: "/echo", params: { query: "تجربة & test", page: 2 } });
    expect(response.data.method).toBe("GET");
    const requestUrl = new URL(response.data.path, origin);
    expect(requestUrl.searchParams.get("query")).toBe("تجربة & test");
    expect(requestUrl.searchParams.get("page")).toBe("2");
  });

  it("preserves a same-authority 307 POST redirect, body and authorization", async () => {
    const { client } = await listen();
    const response = await client.post("/redirect", { value: "fixture" }, { headers: { Authorization: "Bearer fixture-token" } });
    expect(response.data).toMatchObject({ method: "POST", path: "/echo", headers: { authorization: "Bearer fixture-token" } });
    expect(JSON.parse(response.data.body)).toEqual({ value: "fixture" });
  });

  it("does not forward authorization to a different authority on redirect", async () => {
    const target = await listen();
    const source = await listen((_request, response) => {
      response.writeHead(302, { Location: `${target.origin}/echo` });
      response.end();
    });
    const result = await source.client.get("/redirect", { headers: { Authorization: "Bearer fixture-token" } });
    expect(result.data.method).toBe("GET");
    expect(result.data.headers.authorization).toBeUndefined();
  });

  it("preserves structured non-2xx response errors", async () => {
    const { client } = await listen();
    await expect(client.get("/error")).rejects.toMatchObject({
      isAxiosError: true, response: { status: 400, data: { error: "invalid fixture request" } },
    });
  });

  it("preserves environment proxy selection using a loopback-only proxy fixture", async () => {
    let targetRequests = 0;
    const target = await listen((_request, response) => { targetRequests += 1; response.end("target"); });
    const proxy = await listen();
    useFixtureProxy(proxy.origin);
    const response = await axios.get(`${target.origin}/echo`, { adapter: "http", timeout: 1000 });
    expect(response.data.path).toBe(`${target.origin}/echo`);
    expect(targetRequests).toBe(0);
  });

  it("preserves explicit NO_PROXY host-and-port bypass", async () => {
    let proxyRequests = 0;
    const proxy = await listen((_request, response) => { proxyRequests += 1; response.end("proxy"); });
    const target = await listen();
    useFixtureProxy(proxy.origin, new URL(target.origin).host);
    const response = await axios.get(`${target.origin}/echo`, { adapter: "http", timeout: 1000 });
    expect(response.data.path).toBe("/echo");
    expect(proxyRequests).toBe(0);
  });

  it("enforces an explicitly configured short timeout", async () => {
    const { client } = await listen();
    await expect(client.get("/slow", { timeout: 25 })).rejects.toMatchObject({ code: "ECONNABORTED" });
  });

  it("preserves explicit AbortSignal cancellation", async () => {
    const { client } = await listen();
    const controller = new AbortController();
    const request = client.get("/slow", { signal: controller.signal });
    controller.abort();
    await expect(request).rejects.toMatchObject({ code: "ERR_CANCELED" });
  });

  it("accepts a streamed upload within its configured limit", async () => {
    const { client } = await listen();
    const response = await client.post("/echo", Readable.from([Buffer.from("fixture upload")]), {
      maxRedirects: 0, maxBodyLength: 64,
    });
    expect(response.data.body).toBe("fixture upload");
  });

  it("accepts a streamed response within its configured limit", async () => {
    const { origin } = await listen();
    expect(await readStream(`${origin}/payload`, 128)).toBe("x".repeat(64));
  });
});

describe("Axios security regressions", () => {
  it("ignores an inherited default HTTP method in an isolated child process", () => {
    const output = execFileSync(process.execPath, [
      fileURLToPath(new URL("./fixtures/axios-method-probe.mjs", import.meta.url)),
    ], { encoding: "utf8", timeout: 5000 });
    expect(JSON.parse(output)).toEqual({ method: "get" });
  });

  it("enforces maxBodyLength for direct streamed uploads", async () => {
    const { client } = await listen();
    await expect(client.post("/echo", Readable.from([Buffer.alloc(64, "x")]), {
      maxRedirects: 0, maxBodyLength: 16,
    })).rejects.toThrow(/maxBodyLength|Request body larger/i);
  });

  it("enforces maxContentLength while consuming a streamed response", async () => {
    const { origin } = await listen();
    await expect(readStream(`${origin}/payload`, 16)).rejects.toThrow(/maxContentLength/i);
  });
});
