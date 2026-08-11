import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PINNED_NPM_VERSION, validatePinnedNpmAudit } from "../apps/cli/src/release/pinned-npm-audit.js";

const requestedDirectory = process.argv[2];
if (requestedDirectory === undefined) {
	throw new Error("Usage: bun run scripts/audit-pinned-npm.ts <extracted-npm-directory>");
}

const auditDirectory = resolve(requestedDirectory);
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const packageManifest = readJson(resolve(auditDirectory, "package.json"));

if (
	typeof packageManifest !== "object" ||
	packageManifest === null ||
	!("name" in packageManifest) ||
	!("version" in packageManifest) ||
	packageManifest.name !== "npm" ||
	typeof packageManifest.version !== "string"
) {
	throw new Error("Extracted npm CLI has an invalid package manifest.");
}

const audit = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=moderate", "--json"], {
	cwd: auditDirectory,
	encoding: "utf8",
	stdio: ["ignore", "pipe", "pipe"],
});

if (audit.error !== undefined) {
	throw new Error(`Could not execute npm audit: ${audit.error.message}`);
}
if (audit.status !== 0 && audit.status !== 1) {
	throw new Error(`npm audit failed to produce a vulnerability report:\n${audit.stderr}`);
}

const jsonStart = audit.stdout.indexOf("{");
if (jsonStart === -1) {
	throw new Error(`Could not parse npm audit output:\n${audit.stdout}\n${audit.stderr}`);
}

const report = JSON.parse(audit.stdout.slice(jsonStart)) as unknown;
validatePinnedNpmAudit({
	actualNpmVersion: packageManifest.version,
	report,
});

console.log(`Pinned npm CLI ${PINNED_NPM_VERSION} audit passed without exceptions.`);
