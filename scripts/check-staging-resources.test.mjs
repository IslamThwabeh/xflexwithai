import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { stringify } from "smol-toml";
import { parseWorkerConfig, runStagingResourceCheck, validateStagingResources } from "./check-staging-resources.mjs";

function isolatedConfig() {
  return {
    name: "academy-api",
    env: {
      production: {
        name: "academy-production",
        vars: { SITE_URL: "https://academy.example", R2_PUBLIC_URL: "https://media.academy.example" },
        d1_databases: [{ binding: "DB", database_name: "academy", database_id: "11111111-1111-1111-1111-111111111111" }],
        r2_buckets: [{ binding: "VIDEOS_BUCKET", bucket_name: "academy-videos" }, { binding: "FINANCE_RECEIPTS_BUCKET", bucket_name: "academy-receipts" }],
      },
      staging: {
        name: "academy-staging", routes: [], triggers: { crons: [] },
        vars: { ENVIRONMENT: "staging", SITE_URL: "https://staging.academy.example", R2_PUBLIC_URL: "https://staging-media.academy.example" },
        d1_databases: [{ binding: "DB", database_name: "academy-staging", database_id: "22222222-2222-2222-2222-222222222222" }],
        r2_buckets: [{ binding: "VIDEOS_BUCKET", bucket_name: "staging-videos" }, { binding: "FINANCE_RECEIPTS_BUCKET", bucket_name: "staging-receipts" }],
      },
    },
  };
}

test("allows distinct resource identities without modifying the configuration", () => {
  const config = isolatedConfig();
  const before = structuredClone(config);
  assert.deepEqual(validateStagingResources(parseWorkerConfig(stringify(config))), []);
  assert.deepEqual(config, before);
});

for (const field of ["database_id", "database_name"]) {
  test(`rejects the production D1 ${field} even when the other identity differs`, () => {
    const config = isolatedConfig();
    config.env.staging.d1_databases[0][field] = config.env.production.d1_databases[0][field];
    assert.match(validateStagingResources(config).join("\n"), /production resource/);
  });
}

for (const index of [0, 1]) {
  test(`rejects a shared R2 bucket for binding ${index}`, () => {
    const config = isolatedConfig();
    config.env.staging.r2_buckets[index].bucket_name = config.env.production.r2_buckets[1 - index].bucket_name;
    assert.match(validateStagingResources(config).join("\n"), /production resource/);
  });
}

test("checks preview identities and top-level resources as well", () => {
  const config = isolatedConfig();
  config.d1_databases = [{ database_name: "top-level-db", database_id: "33333333-3333-3333-3333-333333333333" }];
  config.env.staging.d1_databases[0].preview_database_id = config.d1_databases[0].database_id;
  config.env.staging.r2_buckets[0].preview_bucket_name = "academy-receipts";
  assert.equal(validateStagingResources(config).filter((error) => error.includes("production resource")).length, 2);
});

test("requires explicit provisioned DB and private receipt/video bindings", () => {
  const config = isolatedConfig();
  config.env.staging.d1_databases[0].database_id = "REPLACE_WITH_UUID";
  config.env.staging.r2_buckets = [];
  assert.match(validateStagingResources(config).join("\n"), /provisioned database UUID/);
  assert.match(validateStagingResources(config).join("\n"), /FINANCE_RECEIPTS_BUCKET/);
  assert.match(validateStagingResources(config).join("\n"), /VIDEOS_BUCKET/);
});

test("rejects unnamed/duplicate bindings and automatic provisioning", () => {
  const config = isolatedConfig();
  config.env.staging.d1_databases = [{ binding: "DB" }, { binding: "DB" }, {}];
  const errors = validateStagingResources(config).join("\n");
  assert.match(errors, /unique named bindings/);
  assert.match(errors, /automatic provisioning/);
});

for (const key of ["SITE_URL", "R2_PUBLIC_URL"]) {
  test(`rejects production ${key} with a different path or trailing dot`, () => {
    const config = isolatedConfig();
    const production = new URL(config.env.production.vars[key]);
    config.env.staging.vars[key] = `https://${production.hostname}./staging`;
    assert.match(validateStagingResources(config).join("\n"), new RegExp(key));
  });
}

test("fails closed on missing environments, origins and resource comparison data", () => {
  assert.notEqual(validateStagingResources({}).length, 0);
  const config = isolatedConfig();
  delete config.env.production.r2_buckets;
  delete config.env.staging.d1_databases;
  delete config.env.staging.vars.SITE_URL;
  assert.equal(validateStagingResources(config).length, 3);
});

test("requires a distinct Worker name and staging environment marker", () => {
  const config = isolatedConfig();
  config.env.staging.name = config.env.production.name;
  config.env.staging.vars.ENVIRONMENT = "production";
  assert.equal(validateStagingResources(config).length, 2);
});

test("rejects active or implicitly inherited routes and schedules", () => {
  const config = isolatedConfig();
  delete config.env.staging.routes;
  delete config.env.staging.triggers;
  config.routes = [{ pattern: "academy.example/*" }];
  config.triggers = { crons: ["* * * * *"] };
  assert.equal(validateStagingResources(config).length, 2);
  config.env.staging.routes = [{ pattern: "academy.example/*" }];
  config.env.staging.triggers = { crons: ["* * * * *"] };
  assert.equal(validateStagingResources(config).length, 2);
});

test("rejects additional bindings until a resource policy covers them", () => {
  const config = isolatedConfig();
  config.env.staging.services = [{ binding: "API", service: "academy-production" }];
  config.queues = { consumers: [{ queue: "production-email" }] };
  assert.equal(validateStagingResources(config).length, 2);
});

test("malformed configuration fails without echoing source values", () => {
  const output = [];
  const sink = { error: (value) => output.push(value), log: (value) => output.push(value) };
  assert.equal(runStagingResourceCheck('SECRET = "sensitive-test-value', sink), 1);
  assert.doesNotMatch(output.join("\n"), /sensitive-test-value/);
});

test("blocks production resource substitution in the repository configuration", () => {
  const source = readFileSync(new URL("../wrangler-worker.toml", import.meta.url), "utf8");
  const config = parseWorkerConfig(source);
  config.env.staging.d1_databases = structuredClone(config.env.production.d1_databases);
  const output = [];
  assert.equal(runStagingResourceCheck(stringify(config), { error: (value) => output.push(value), log: (value) => output.push(value) }), 1);
  assert.match(output.join("\n"), /production resource/);
});
