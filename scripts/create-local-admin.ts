import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import bcrypt from "bcryptjs";

type SqliteDatabase = {
  close(): void;
  prepare(query: string): {
    run(...values: unknown[]): unknown;
  };
};

type SqliteDatabaseConstructor = new (
  filename: string,
  options?: { fileMustExist?: boolean },
) => SqliteDatabase;

const databaseUrl =
  process.env.DATABASE_URL?.trim() || "./xflexwithai.dev.db";
const email = process.env.LOCAL_ADMIN_EMAIL?.trim() || "admin@local.test";
const name = process.env.LOCAL_ADMIN_NAME?.trim() || "Local Admin";
const suppliedPassword = process.env.LOCAL_ADMIN_PASSWORD?.trim();
const password = suppliedPassword || randomBytes(18).toString("base64url");

if (
  databaseUrl.includes("://") ||
  !databaseUrl.toLowerCase().endsWith(".db")
) {
  throw new Error(
    "Refusing to create a local admin: DATABASE_URL must be a local .db file",
  );
}

if (!existsSync(databaseUrl)) {
  throw new Error(
    `Local database ${databaseUrl} does not exist. Run pnpm db:push first.`,
  );
}

if (password.length < 12) {
  throw new Error("LOCAL_ADMIN_PASSWORD must contain at least 12 characters");
}

const packageName = "better-sqlite3";
const imported = await import(packageName);
const Database = (imported.default ?? imported) as SqliteDatabaseConstructor;
const sqlite = new Database(databaseUrl, { fileMustExist: true });

try {
  const passwordHash = await bcrypt.hash(password, 12);

  sqlite
    .prepare(
      `INSERT INTO admins (
        email,
        passwordHash,
        name,
        passwordChangedAt,
        createdAt,
        updatedAt,
        lastSignedIn
      ) VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(email) DO UPDATE SET
        passwordHash = excluded.passwordHash,
        name = excluded.name,
        passwordChangedAt = datetime('now'),
        updatedAt = datetime('now')`,
    )
    .run(email, passwordHash, name);
} finally {
  sqlite.close();
}

console.log("Local admin is ready.");
console.log(`Database: ${databaseUrl}`);
console.log(`Email: ${email}`);
console.log(`Password: ${password}`);
console.log(
  suppliedPassword
    ? "The password came from LOCAL_ADMIN_PASSWORD."
    : "A random local-only password was generated. Save it for this QA session.",
);
