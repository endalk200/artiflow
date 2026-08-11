export const PINNED_NPM_VERSION = "11.19.0" as const;

export type PinnedNpmPatch = {
	readonly integrity: string;
	readonly packageName: string;
	readonly sourceVersion: string;
	readonly targetVersion: string;
};

// npm 11.19.0 predates these upstream security patches. The release workflow
// replaces only these package directories in the official npm tarball, audits
// the resulting tree, checksums it, and uses that same artifact for staging.
export const PINNED_NPM_PATCHES: ReadonlyArray<PinnedNpmPatch> = [
	{
		integrity: "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
		packageName: "brace-expansion",
		sourceVersion: "5.0.7",
		targetVersion: "5.0.9",
	},
	{
		integrity: "sha512-1e9d3kb97NHJTIJDZW9rKqW2h6+dFa50Dy0fpPSMQp2ADje5gvKsXmdiK6dwY5t76TaTt5+P5N1Y/LoToIxP6g==",
		packageName: "ip-address",
		sourceVersion: "10.2.0",
		targetVersion: "10.3.1",
	},
	{
		integrity: "sha512-XdhtCvlMywwxpCW8YEq3lOXBJpUPTR2OHHcwLPO3HwsJqOHa2Ok/oJ7ruGzp+JrKoRPVCzJwAdEjqLW/vNRPHA==",
		packageName: "tar",
		sourceVersion: "7.5.19",
		targetVersion: "7.5.21",
	},
	{
		integrity: "sha512-LIY910g9TI13YS95lrMFrs8Rm/u/irgHeTWoKCoteeJ04CUJ92eEfj0rVn+7VKMPBpUPiUoBKfhNyLI23EE/KA==",
		packageName: "undici",
		sourceVersion: "6.27.0",
		targetVersion: "6.28.0",
	},
];

type PackageManifest = {
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly name: string;
	readonly optionalDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly version: string;
};

const severityRank = {
	critical: 4,
	high: 3,
	low: 1,
	moderate: 2,
} as const;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const dependencyContract = ({ dependencies, optionalDependencies, peerDependencies }: PackageManifest) =>
	JSON.stringify({
		dependencies: dependencies ?? {},
		optionalDependencies: optionalDependencies ?? {},
		peerDependencies: peerDependencies ?? {},
	});

export const validatePinnedNpmPatch = ({
	actualIntegrity,
	patch,
	replacementManifest,
	sourceManifest,
}: {
	readonly actualIntegrity: string;
	readonly patch: PinnedNpmPatch;
	readonly replacementManifest: PackageManifest;
	readonly sourceManifest: PackageManifest;
}): void => {
	if (sourceManifest.name !== patch.packageName || sourceManifest.version !== patch.sourceVersion) {
		throw new Error(
			`Pinned npm contains ${sourceManifest.name}@${sourceManifest.version}; expected ${patch.packageName}@${patch.sourceVersion}.`,
		);
	}
	if (replacementManifest.name !== patch.packageName || replacementManifest.version !== patch.targetVersion) {
		throw new Error(
			`Replacement contains ${replacementManifest.name}@${replacementManifest.version}; expected ${patch.packageName}@${patch.targetVersion}.`,
		);
	}
	if (actualIntegrity !== patch.integrity) {
		throw new Error(`Replacement integrity for ${patch.packageName}@${patch.targetVersion} does not match policy.`);
	}
	if (dependencyContract(sourceManifest) !== dependencyContract(replacementManifest)) {
		throw new Error(`Replacement dependency contract changed for ${patch.packageName}@${patch.targetVersion}.`);
	}
};

export const validatePinnedNpmAudit = ({
	actualNpmVersion,
	report,
}: {
	readonly actualNpmVersion: string;
	readonly report: unknown;
}): void => {
	if (actualNpmVersion !== PINNED_NPM_VERSION) {
		throw new Error(`npm CLI version ${actualNpmVersion} does not match audited version ${PINNED_NPM_VERSION}.`);
	}

	if (!isRecord(report) || !isRecord(report.vulnerabilities)) {
		throw new Error("npm audit returned a malformed vulnerabilities report.");
	}

	const findings: Array<string> = [];

	for (const [packageName, value] of Object.entries(report.vulnerabilities)) {
		if (!isRecord(value) || typeof value.severity !== "string") {
			throw new Error(`npm audit returned a malformed finding for ${packageName}.`);
		}

		const rank = severityRank[value.severity as keyof typeof severityRank];
		if (rank === undefined) {
			throw new Error(`npm audit returned an unknown severity for ${packageName}: ${value.severity}.`);
		}
		if (rank >= severityRank.moderate) findings.push(`${packageName} (${value.severity})`);
	}

	if (findings.length > 0) {
		throw new Error(`Pinned npm CLI audit finding(s):\n${findings.sort().join("\n")}`);
	}
};
