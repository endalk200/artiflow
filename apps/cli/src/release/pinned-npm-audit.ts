export const PINNED_NPM_VERSION = "11.18.0" as const;
export const PINNED_NPM_AUDIT_EXPIRES_AT = "2026-08-24T00:00:00.000Z" as const;

type AuditException = {
	readonly advisoryId: string;
	readonly packageName: string;
	readonly version: string;
};

// npm 11.18.0 bundles these versions, and no released Node 22-compatible npm
// CLI contains all upstream fixes yet. This policy is limited to the official
// pinned CLI used to stage a checksummed Artiflow tarball and expires below.
const auditExceptions: ReadonlyArray<AuditException> = [
	{
		advisoryId: "GHSA-mh99-v99m-4gvg",
		packageName: "brace-expansion",
		version: "5.0.7",
	},
	{
		advisoryId: "GHSA-rgw5-rvv9-x895",
		packageName: "brace-expansion",
		version: "5.0.7",
	},
	{
		advisoryId: "GHSA-mwp4-54f8-5fhr",
		packageName: "ip-address",
		version: "10.2.0",
	},
	{
		advisoryId: "GHSA-4xrf-jv44-h6hh",
		packageName: "ip-address",
		version: "10.2.0",
	},
	{
		advisoryId: "GHSA-22jq-vg5j-6vgg",
		packageName: "ip-address",
		version: "10.2.0",
	},
	{
		advisoryId: "GHSA-r292-9mhp-454m",
		packageName: "tar",
		version: "7.5.19",
	},
	{
		advisoryId: "GHSA-8xcm-r25x-g524",
		packageName: "undici",
		version: "6.27.0",
	},
	{
		advisoryId: "GHSA-m8rv-5g2x-5cg5",
		packageName: "undici",
		version: "6.27.0",
	},
	{
		advisoryId: "GHSA-v3r7-h72x-cjcm",
		packageName: "undici",
		version: "6.27.0",
	},
];

const severityRank = {
	critical: 4,
	high: 3,
	low: 1,
	moderate: 2,
} as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const exceptionKey = ({ advisoryId, packageName, version }: AuditException) =>
	`${packageName}@${version}:${advisoryId}`;

const exceptionKeys = new Set(auditExceptions.map(exceptionKey));

const advisoryIdFrom = (value: unknown): string | undefined => {
	if (!isRecord(value) || typeof value.url !== "string") return undefined;

	try {
		const advisoryId = new URL(value.url).pathname.split("/").at(-1);
		return advisoryId?.match(/^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/i)?.[0];
	} catch {
		return undefined;
	}
};

export const validatePinnedNpmAudit = ({
	actualNpmVersion,
	now,
	report,
	versionsByNode,
}: {
	readonly actualNpmVersion: string;
	readonly now: Date;
	readonly report: unknown;
	readonly versionsByNode: Readonly<Record<string, string>>;
}): ReadonlyArray<string> => {
	if (actualNpmVersion !== PINNED_NPM_VERSION) {
		throw new Error(`npm CLI version ${actualNpmVersion} does not match audited version ${PINNED_NPM_VERSION}.`);
	}

	if (!isRecord(report) || !isRecord(report.vulnerabilities)) {
		throw new Error("npm audit returned a malformed vulnerabilities report.");
	}

	const accepted: Array<string> = [];
	const unexpected: Array<string> = [];

	for (const [packageName, value] of Object.entries(report.vulnerabilities)) {
		if (!isRecord(value) || typeof value.severity !== "string") {
			throw new Error(`npm audit returned a malformed finding for ${packageName}.`);
		}

		const rank = severityRank[value.severity as keyof typeof severityRank];
		if (rank === undefined) {
			throw new Error(`npm audit returned an unknown severity for ${packageName}: ${value.severity}.`);
		}
		if (rank < severityRank.moderate) continue;

		if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
			throw new Error(`npm audit did not identify an installed node for ${packageName}.`);
		}
		if (!Array.isArray(value.via) || value.via.length === 0) {
			throw new Error(`npm audit did not identify an advisory for ${packageName}.`);
		}

		const advisoryIds = value.via.map(advisoryIdFrom);
		if (advisoryIds.some((advisoryId) => advisoryId === undefined)) {
			throw new Error(`npm audit returned an indirect or malformed advisory for ${packageName}.`);
		}

		for (const node of value.nodes) {
			if (typeof node !== "string") {
				throw new Error(`npm audit returned a malformed installed node for ${packageName}.`);
			}

			const version = versionsByNode[node];
			if (version === undefined) {
				throw new Error(`Could not resolve the installed version for ${packageName} at ${node}.`);
			}

			for (const advisoryId of advisoryIds as ReadonlyArray<string>) {
				const finding = { advisoryId, packageName, version };
				const summary = `${advisoryId} ${packageName}@${version} (${node})`;
				if (exceptionKeys.has(exceptionKey(finding))) accepted.push(summary);
				else unexpected.push(summary);
			}
		}
	}

	if (unexpected.length > 0) {
		throw new Error(`Unexpected npm CLI audit finding(s):\n${unexpected.sort().join("\n")}`);
	}

	if (accepted.length > 0 && now.getTime() >= Date.parse(PINNED_NPM_AUDIT_EXPIRES_AT)) {
		throw new Error(`Temporary npm CLI audit exceptions expired at ${PINNED_NPM_AUDIT_EXPIRES_AT}.`);
	}

	return accepted.sort();
};
