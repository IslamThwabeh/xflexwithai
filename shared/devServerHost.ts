/** Local development is private unless network access is explicitly requested. */
export function getDevServerHost(requestedHost?: string): string {
  return requestedHost?.trim() || "127.0.0.1";
}

export function getServerListenHost(environment?: string, requestedDevHost?: string): string | undefined {
  return environment === "development" ? getDevServerHost(requestedDevHost) : undefined;
}
