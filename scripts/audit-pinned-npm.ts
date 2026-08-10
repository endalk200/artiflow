import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

import {
	PINNED_NPM_AUDIT_EXPIRES_AT,
	PINNED_NPM_VERSION,
	validatePinnedNpmAudit,
} from "../apps/cli/src/release/pinned-npm-audit.js";

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
const versionsByNode: Record<string, string> = {};

if (typeof report === "object" && report !== null && "vulnerabilities" in report) {
	const vulnerabilities = report.vulnerabilities;
	if (typeof vulnerabilities === "object" && vulnerabilities !== null) {
		for (const value of Object.values(vulnerabilities)) {
			if (typeof value !== "object" || value === null || !("nodes" in value) || !Array.isArray(value.nodes)) {
				continue;
			}

			for (const node of value.nodes) {
				if (typeof node !== "string") continue;

				const nodeDirectory = resolve(auditDirectory, node);
				if (!nodeDirectory.startsWith(`${auditDirectory}${sep}`)) {
					throw new Error(`npm audit reported a node outside the extracted package: ${node}.`);
				}

				const nodeManifest = readJson(resolve(nodeDirectory, "package.json"));
				if (
					typeof nodeManifest !== "object" ||
					nodeManifest === null ||
					!("version" in nodeManifest) ||
					typeof nodeManifest.version !== "string"
				) {
					throw new Error(`Installed npm dependency has an invalid package manifest: ${node}.`);
				}
				versionsByNode[node] = nodeManifest.version;
			}
		}
	}
}

const accepted = validatePinnedNpmAudit({
	actualNpmVersion: packageManifest.version,
	now: new Date(),
	report,
	versionsByNode,
});

if (accepted.length === 0) {
	console.log(`Pinned npm CLI ${PINNED_NPM_VERSION} audit passed without exceptions.`);
} else {
	console.warn(
		[
			`Pinned npm CLI ${PINNED_NPM_VERSION} audit accepted temporary exceptions until ${PINNED_NPM_AUDIT_EXPIRES_AT}:`,
			...accepted.map((finding) => `- ${finding}`),
		].join("\n"),
	);
}
