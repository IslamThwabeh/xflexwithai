type ErrorLike = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  name?: unknown;
};

const MAX_ERROR_CHAIN_DEPTH = 12;

function readErrorProperty(error: object, property: keyof ErrorLike): unknown {
  try {
    return (error as ErrorLike)[property];
  } catch {
    return undefined;
  }
}

/**
 * Walk errors produced by Drizzle, D1, and SQLite without trusting custom
 * getters or following a cyclic cause chain forever.
 */
export function getErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<object>();
  let current = error;

  while (current !== undefined && current !== null && chain.length < MAX_ERROR_CHAIN_DEPTH) {
    if (typeof current === "object" && seen.has(current)) break;
    chain.push(current);
    if (typeof current !== "object") break;
    seen.add(current);
    current = readErrorProperty(current, "cause");
  }

  return chain;
}

export function getErrorChainMessages(error: unknown): string[] {
  return getErrorChain(error)
    .map(item => {
      if (typeof item === "string") return item;
      if (typeof item !== "object" || item === null) return String(item);
      const message = readErrorProperty(item, "message");
      return typeof message === "string" ? message : "";
    })
    .filter(message => message.length > 0);
}

export function errorChainMatches(error: unknown, matcher: RegExp | string): boolean {
  return getErrorChainMessages(error).some(message =>
    typeof matcher === "string"
      ? message.includes(matcher)
      : new RegExp(matcher.source, matcher.flags.replace("g", "")).test(message)
  );
}

export function isSqliteUniqueConstraintError(error: unknown): boolean {
  return errorChainMatches(
    error,
    /unique constraint|constraint failed.*unique|already exists/i,
  ) || getErrorChain(error).some(item => {
    if (typeof item !== "object" || item === null) return false;
    const code = readErrorProperty(item, "code");
    return typeof code === "string" && /SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY/i.test(code);
  });
}

export function isDatabasePersistenceError(error: unknown): boolean {
  return getErrorChain(error).some(item => {
    if (typeof item !== "object" || item === null) return false;
    const code = readErrorProperty(item, "code");
    const name = readErrorProperty(item, "name");
    return (typeof code === "string" && /^(SQLITE_|D1_)/i.test(code))
      || (typeof name === "string" && /DrizzleQueryError|SqliteError|D1Error/i.test(name));
  }) || errorChainMatches(
    error,
    /Failed query:|SQLITE_(?:ERROR|CONSTRAINT)|D1_ERROR|(?:unique|foreign key|not null|check) constraint failed/i,
  );
}

/** Metadata suitable for server logs; intentionally excludes SQL and params. */
export function getDatabaseErrorDiagnostic(error: unknown) {
  return getErrorChain(error).map(item => {
    if (typeof item !== "object" || item === null) {
      return { type: typeof item };
    }
    const name = readErrorProperty(item, "name");
    const code = readErrorProperty(item, "code");
    return {
      name: typeof name === "string" ? name : undefined,
      code: typeof code === "string" || typeof code === "number" ? code : undefined,
    };
  });
}
