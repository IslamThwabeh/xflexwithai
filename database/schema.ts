/**
 * Legacy compatibility entry point.
 *
 * The active schema for this workspace is SQLite-based and lives in
 * `schema-sqlite.ts`. Keep this file as a thin re-export so older imports
 * continue to resolve without maintaining a second divergent schema.
 */

export * from "./schema-sqlite.ts";