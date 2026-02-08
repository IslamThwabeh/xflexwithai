import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: "./drizzle/schema-sqlite.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./xflexwithai.db",
  },
});
