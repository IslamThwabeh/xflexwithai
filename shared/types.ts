/**
 * Unified type exports
 * Import shared types from this single entry point.
 *
 * Note: uses `export *` instead of `export type *` for CodeGraph
 * tree-sitter compatibility. Runtime behavior is identical since
 * schema-sqlite.ts only exports types.
 */

export * from "../database/schema-sqlite.ts";
export * from "./_core/errors";
