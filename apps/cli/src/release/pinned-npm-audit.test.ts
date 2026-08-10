import { describe, expect, it } from "vitest";

import { PINNED_NPM_AUDIT_EXPIRES_AT, PINNED_NPM_VERSION, validatePinnedNpmAudit } from "./pinned-npm-audit.js";

const knownAuditReport = {
	vulnerabilities: {
		"brace-expansion": {
			nodes: ["node_modules/brace-expansion"],
			severity: "high",
			via: [
				{ url: "https://github.com/advisories/GHSA-mh99-v99m-4gvg" },
				{ url: "https://github.com/advisories/GHSA-rgw5-rvv9-x895" },
			],
		},
		"ip-address": {
			nodes: ["node_modules/ip-address"],
			severity: "high",
			via: [
				{ url: "https://github.com/advisories/GHSA-mwp4-54f8-5fhr" },
				{ url: "https://github.com/advisories/GHSA-4xrf-jv44-h6hh" },
				{ url: "https://github.com/advisories/GHSA-22jq-vg5j-6vgg" },
			],
		},
		tar: {
			nodes: ["node_modules/tar"],
			severity: "moderate",
			via: [{ url: "https://github.com/advisories/GHSA-r292-9mhp-454m" }],
		},
		undici: {
			nodes: ["node_modules/undici"],
			severity: "moderate",
			via: [
				{ url: "https://github.com/advisories/GHSA-8xcm-r25x-g524" },
				{ url: "https://github.com/advisories/GHSA-m8rv-5g2x-5cg5" },
				{ url: "https://github.com/advisories/GHSA-v3r7-h72x-cjcm" },
			],
		},
	},
};

const knownVersions = {
	"node_modules/brace-expansion": "5.0.7",
	"node_modules/ip-address": "10.2.0",
	"node_modules/tar": "7.5.19",
	"node_modules/undici": "6.27.0",
};

const validate = (
	report: unknown = knownAuditReport,
	versionsByNode: Readonly<Record<string, string>> = knownVersions,
	now = new Date("2026-08-10T00:00:00.000Z"),
	actualNpmVersion: string = PINNED_NPM_VERSION,
) =>
	validatePinnedNpmAudit({
		actualNpmVersion,
		now,
		report,
		versionsByNode,
	});

describe("pinned npm CLI audit policy", () => {
	it("accepts only the known findings for their exact bundled versions", () => {
		expect(validate()).toHaveLength(9);
	});

	it("rejects a newly reported advisory", () => {
		const report = structuredClone(knownAuditReport);
		report.vulnerabilities.undici.via.push({
			url: "https://github.com/advisories/GHSA-new0-new0-new0",
		});

		expect(() => validate(report)).toThrow(/Unexpected npm CLI audit finding.*GHSA-new0-new0-new0/s);
	});

	it("rejects an allowed advisory when the installed version changes", () => {
		expect(() =>
			validate(knownAuditReport, {
				...knownVersions,
				"node_modules/tar": "7.5.20",
			}),
		).toThrow(/Unexpected npm CLI audit finding.*tar@7\.5\.20/s);
	});

	it("expires the temporary exceptions", () => {
		expect(() => validate(knownAuditReport, knownVersions, new Date(PINNED_NPM_AUDIT_EXPIRES_AT))).toThrow(
			/Temporary npm CLI audit exceptions expired/,
		);
	});

	it("allows a clean report after the exception expiry", () => {
		expect(validate({ vulnerabilities: {} }, {}, new Date("2027-01-01T00:00:00.000Z"))).toEqual([]);
	});

	it("rejects a different npm CLI version", () => {
		expect(() => validate(knownAuditReport, knownVersions, undefined, "11.19.0")).toThrow(
			/npm CLI version 11\.19\.0 does not match audited version 11\.18\.0/,
		);
	});
});
