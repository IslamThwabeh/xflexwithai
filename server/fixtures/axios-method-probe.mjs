import axios from "axios";

// Isolated regression probe: the adapter returns locally and never opens a socket.
Object.defineProperty(Object.prototype, "method", {
  value: "post", configurable: true, writable: true,
});
try {
  const response = await axios.request({
    url: "http://127.0.0.1/unused",
    adapter: async (config) => ({
      data: { method: config.method }, status: 200, statusText: "OK", headers: {}, config,
    }),
  });
  process.stdout.write(JSON.stringify(response.data));
} finally {
  delete Object.prototype.method;
}
