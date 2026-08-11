import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
	PINNED_NPM_PATCHES,
	PINNED_NPM_VERSION,
	validatePinnedNpmAudit,
	validatePinnedNpmPatch,
} from "./pinned-npm-audit.js";

const cleanAuditReport = {
	vulnerabilities: {},
};

const patch = PINNED_NPM_PATCHES[0];
if (patch === undefined) throw new Error("Expected a pinned npm patch fixture.");

const sourceManifest = {
	dependencies: { "balanced-match": "^4.0.2" },
	name: patch.packageName,
	version: patch.sourceVersion,
};
const replacementManifest = {
	dependencies: { "balanced-match": "^4.0.2" },
	name: patch.packageName,
	version: patch.targetVersion,
};

describe("pinned npm CLI policy", () => {
	it("keeps the workflow pin aligned with the audited version", () => {
		const workflowsDirectory = join(import.meta.dirname, "..", "..", "..", "..", ".github", "workflows");

		for (const workflowName of ["publish-npm.yml", "verify-pinned-npm.yml"]) {
			const workflow = readFileSync(join(workflowsDirectory, workflowName), "utf8");
			expect(workflow).toContain(`PINNED_NPM_VERSION: "${PINNED_NPM_VERSION}"`);
		}
	});

	it("accepts a clean audit report", () => {
		expect(
			validatePinnedNpmAudit({
				actualNpmVersion: PINNED_NPM_VERSION,
				report: cleanAuditReport,
			}),
		).toBeUndefined();
	});

	it("rejects every moderate-or-higher finding", () => {
		expect(() =>
			validatePinnedNpmAudit({
				actualNpmVersion: PINNED_NPM_VERSION,
				report: {
					vulnerabilities: {
						undici: { severity: "moderate" },
					},
				},
			}),
		).toThrow(/Pinned npm CLI audit finding.*undici \(moderate\)/s);
	});

	it("rejects a different npm CLI version", () => {
		expect(() =>
			validatePinnedNpmAudit({
				actualNpmVersion: "11.20.0",
				report: cleanAuditReport,
			}),
		).toThrow(/npm CLI version 11\.20\.0 does not match audited version 11\.19\.0/);
	});

	it("accepts an integrity-pinned patch with an unchanged dependency contract", () => {
		expect(
			validatePinnedNpmPatch({
				actualIntegrity: patch.integrity,
				patch,
				replacementManifest,
				sourceManifest,
			}),
		).toBeUndefined();
	});

	it("rejects source-version drift", () => {
		expect(() =>
			validatePinnedNpmPatch({
				actualIntegrity: patch.integrity,
				patch,
				replacementManifest,
				sourceManifest: { ...sourceManifest, version: "5.0.8" },
			}),
		).toThrow(/expected brace-expansion@5\.0\.7/);
	});

	it("rejects replacement-integrity drift", () => {
		expect(() =>
			validatePinnedNpmPatch({
				actualIntegrity: "sha512-unexpected",
				patch,
				replacementManifest,
				sourceManifest,
			}),
		).toThrow(/integrity.*does not match policy/);
	});

	it("rejects a changed replacement dependency contract", () => {
		expect(() =>
			validatePinnedNpmPatch({
				actualIntegrity: patch.integrity,
				patch,
				replacementManifest: {
					...replacementManifest,
					dependencies: { "balanced-match": "^5.0.0" },
				},
				sourceManifest,
			}),
		).toThrow(/dependency contract changed/);
	});
});
