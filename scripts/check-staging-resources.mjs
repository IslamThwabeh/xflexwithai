#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parse } from "smol-toml";

const configUrl = new URL("../wrangler-worker.toml", import.meta.url);
const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const normalized = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";

export function parseWorkerConfig(source) {
  return parse(source, { unsafeKeyBehaviour: "throw" });
}

// This is a local resource check, not an attestation of deployed secret or email isolation.
export function validateStagingResources(config) {
  const errors = [];
  const production = config.env?.production;
  const staging = config.env?.staging;
  if (!production || !staging) return ["Explicit production and staging environments are required."];

  if (!nonEmptyString(staging.name) || [config.name, production.name].some(
    (name) => normalized(name) === normalized(staging.name),
  )) errors.push("Staging must have a distinct explicit Worker name.");
  if (staging.vars?.ENVIRONMENT !== "staging") {
    errors.push("Staging ENVIRONMENT must explicitly be staging.");
  }

  for (const key of ["SITE_URL", "R2_PUBLIC_URL"]) {
    try {
      const url = new URL(staging.vars?.[key]);
      const productionUrl = new URL(production.vars?.[key]);
      if (url.protocol !== "https:" || url.username || url.password
        || url.hostname.replace(/\.$/, "") === productionUrl.hostname.replace(/\.$/, "")) {
        throw new Error("Unsafe origin");
      }
    } catch {
      errors.push(`Staging ${key} must be an explicit HTTPS URL on a different host from production.`);
    }
  }

  for (const [key, requiredBindings, identityFields] of [
    ["d1_databases", ["DB"], ["database_id", "database_name", "preview_database_id"]],
    ["r2_buckets", ["VIDEOS_BUCKET", "FINANCE_RECEIPTS_BUCKET"], ["bucket_name", "preview_bucket_name"]],
  ]) {
    const bindings = staging[key];
    const productionBindings = production[key];
    if (!Array.isArray(bindings) || !Array.isArray(productionBindings) || !productionBindings.length) {
      errors.push(`Explicit staging and production ${key} are required for comparison.`);
      continue;
    }
    const productionIdentities = new Set(
      [...productionBindings, ...(Array.isArray(config[key]) ? config[key] : [])]
        .flatMap((binding) => identityFields.map((field) => normalized(binding[field])))
        .filter(Boolean),
    );
    const seenBindings = new Set();
    for (const binding of bindings) {
      if (!nonEmptyString(binding.binding) || seenBindings.has(binding.binding)) {
        errors.push(`Staging ${key} must have unique named bindings.`);
      }
      seenBindings.add(binding.binding);
      const fields = key === "d1_databases" ? ["database_name", "database_id"] : ["bucket_name"];
      if (fields.some((field) => !nonEmptyString(binding[field]))) {
        errors.push(`Staging ${key} must specify resource identities; automatic provisioning is not allowed.`);
      }
      if (key === "d1_databases"
        && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(binding.database_id ?? "")) {
        errors.push("Staging D1 requires a provisioned database UUID.");
      }
      if (identityFields.some((field) => productionIdentities.has(normalized(binding[field])))) {
        errors.push(`Staging ${key} references a production resource.`);
      }
    }
    for (const binding of requiredBindings) {
      if (!seenBindings.has(binding)) errors.push(`Staging ${key} is missing ${binding}.`);
    }
  }

  // Explicit empty values avoid inheriting future top-level routes or schedules.
  if (!Array.isArray(staging.routes) || staging.routes.length || config.route || staging.route) {
    errors.push("Staging must explicitly set routes = [] and must not configure a route.");
  }
  if (!Array.isArray(staging.triggers?.crons) || staging.triggers.crons.length) {
    errors.push("Staging must explicitly set triggers.crons = [] until scheduled jobs are isolated.");
  }
  for (const key of ["kv_namespaces", "queues", "services", "durable_objects", "hyperdrive", "workflows"]) {
    if (config[key] !== undefined || staging[key] !== undefined) {
      errors.push(`Staging ${key} needs an isolation policy before this preflight can allow it.`);
    }
  }
  return errors;
}

export function runStagingResourceCheck(source, output = console) {
  let errors;
  try {
    errors = validateStagingResources(parseWorkerConfig(source));
  } catch {
    // A TOML parser error may include source text; do not echo configuration values.
    errors = ["Worker configuration could not be parsed safely."];
  }
  if (errors.length) {
    output.error("Staging resource preflight failed; no build or deployment was started.");
    for (const error of errors) output.error(`- ${error}`);
    output.error("See docs/security-staging-isolation.md for the remaining setup.");
    return 1;
  }
  output.log("Staging resource checks passed. Verify deployed credentials, outbound integrations and frontend targets separately before testing.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length > 2) throw new Error("This preflight does not accept configuration overrides.");
    process.exitCode = runStagingResourceCheck(readFileSync(configUrl, "utf8"));
  } catch {
    console.error("Staging resource preflight could not run; no build or deployment was started.");
    process.exitCode = 1;
  }
}
