import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./database/schema-sqlite.ts",
  out: "./database/drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./xflexwithai.db",
  },
});
