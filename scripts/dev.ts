import { randomBytes } from "node:crypto";
import { config } from "dotenv";

config();
process.env.NODE_ENV = "development";

if (!process.env.JWT_SECRET?.trim()) {
  process.env.JWT_SECRET = randomBytes(48).toString("base64url");
  console.warn(
    "[dev] JWT_SECRET is not set; using an ephemeral local session secret.",
  );
}

await import("../backend/_core/index");
