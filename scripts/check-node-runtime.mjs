#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Node's October 2026 security fixes are included in this supported LTS line.
export const MINIMUM_NODE_VERSION = "24.22.1";

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim());
  return match ? match.slice(1).map(Number) : null;
}

export function isApprovedNodeVersion(value, minimum = MINIMUM_NODE_VERSION) {
  const actual = parseVersion(value);
  const required = parseVersion(minimum);
  if (!actual || !required || actual[0] !== required[0]) return false;
  return actual[1] > required[1] || (actual[1] === required[1] && actual[2] >= required[2]);
}

export function validateNodeRuntime({ version, pinnedVersion, nvmVersion, engineRange }) {
  const errors = [];
  if (!isApprovedNodeVersion(pinnedVersion)) {
    errors.push(`.node-version must select a stable, security-patched Node 24 release (minimum ${MINIMUM_NODE_VERSION}).`);
  }
  if (nvmVersion !== pinnedVersion) errors.push(".nvmrc and .node-version must select the same release.");
  if (engineRange !== `>=${pinnedVersion} <25`) errors.push("package.json engines.node must agree with the pinned Node 24 minimum.");
  if (!isApprovedNodeVersion(version) || !isApprovedNodeVersion(version, pinnedVersion)) {
    errors.push(`This command requires patched Node 24, version ${pinnedVersion} or later in the same major line.`);
  }
  return errors;
}

export function checkProjectNodeRuntime(version = process.version, output = console) {
  let errors;
  try {
    const pinnedVersion = readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim();
    const nvmVersion = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    errors = validateNodeRuntime({ version, pinnedVersion, nvmVersion, engineRange: manifest.engines?.node });
  } catch {
    errors = ["Cannot verify the project Node runtime policy."];
  }
  if (errors.length) {
    output.error("Node runtime check failed before the requested task started.");
    for (const error of errors) output.error(`- ${error}`);
    output.error('Windows PowerShell: . .\\scripts\\use-project-node.ps1 -Install');
    output.error("Other environments: select the release in .node-version and rerun this check.");
    return 1;
  }
  output.log(`Node runtime check passed (${version}).`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = checkProjectNodeRuntime();
}
