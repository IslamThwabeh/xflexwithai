import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { checkProjectNodeRuntime, isApprovedNodeVersion, validateNodeRuntime } from "./check-node-runtime.mjs";

const policy = { pinnedVersion: "24.22.1", nvmVersion: "24.22.1", engineRange: ">=24.22.1 <25" };

for (const version of ["24.11.0", "v24.22.0", "22.23.4", "26.12.1", "20.19.0", "24.22.1-rc.1", "garbage"]) {
  test(`rejects an unapproved runtime: ${version}`, () => {
    assert.equal(isApprovedNodeVersion(version), false);
    assert.notEqual(validateNodeRuntime({ ...policy, version }).length, 0);
  });
}

test("accepts the fixed release and later stable patches within Node 24", () => {
  for (const version of ["24.22.1", "v24.22.2", "24.23.0"]) {
    assert.deepEqual(validateNodeRuntime({ ...policy, version }), []);
  }
});

test("does not allow a pin downgrade to reopen the original runtime exposure", () => {
  assert.notEqual(validateNodeRuntime({ version: "24.11.0", pinnedVersion: "24.11.0", nvmVersion: "24.11.0", engineRange: ">=24.11.0 <25" }).length, 0);
});

test("enforces consistency across version-manager files and package installation policy", () => {
  assert.match(validateNodeRuntime({ ...policy, version: "24.22.1", nvmVersion: "24.11.0" }).join("\n"), /\.nvmrc/);
  assert.match(validateNodeRuntime({ ...policy, version: "24.22.1", engineRange: ">=20.19.0" }).join("\n"), /engines/);
});

test("a newer project minimum also rejects older otherwise patched runtimes", () => {
  assert.notEqual(validateNodeRuntime({ version: "24.22.1", pinnedVersion: "24.23.0", nvmVersion: "24.23.0", engineRange: ">=24.23.0 <25" }).length, 0);
});

test("the repository policy accepts its pinned release and explains the old system runtime rejection", () => {
  const messages = [];
  const output = { error: (value) => messages.push(value), log: (value) => messages.push(value) };
  const pinnedVersion = readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim();
  assert.equal(checkProjectNodeRuntime(pinnedVersion, output), 0);
  assert.equal(checkProjectNodeRuntime("24.11.0", output), 1);
  assert.match(messages.join("\n"), /use-project-node\.ps1/);
});

test("the command line returns the runtime policy result without invoking another task", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./check-node-runtime.mjs", import.meta.url))], { encoding: "utf8" });
  assert.equal(result.status, checkProjectNodeRuntime(process.version, { log() {}, error() {} }));
  assert.match(result.stdout + result.stderr, /Node runtime check/);
});
