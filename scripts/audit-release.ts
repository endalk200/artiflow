import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

type Advisory = {
	readonly severity: "low" | "moderate" | "high" | "critical";
	readonly title: string;
	readonly url: string;
};

type AuditReport = Record<string, ReadonlyArray<Advisory>>;

type PackageManifest = {
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly devDependencies?: Readonly<Record<string, string>>;
	readonly name?: string;
	readonly optionalDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
};

const severityRank = {
	low: 0,
	moderate: 1,
	high: 2,
	critical: 3,
} as const satisfies Record<Advisory["severity"], number>;

const workspaceFlagIndex = process.argv.indexOf("--workspace");
const workspacePath = workspaceFlagIndex === -1 ? undefined : process.argv.at(workspaceFlagIndex + 1);
const includedPackageNames = process.argv.flatMap((argument, index, arguments_) =>
	argument === "--include" ? [arguments_.at(index + 1)] : [],
);

if (workspaceFlagIndex !== -1 && workspacePath === undefined) {
	throw new Error("--workspace requires a path relative to the repository root.");
}

if (includedPackageNames.some((packageName) => packageName === undefined)) {
	throw new Error("--include requires a package name.");
}

const repositoryRoot = process.cwd();

const readManifest = (manifestPath: string): PackageManifest =>
	JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;

const findInstalledManifest = (packageName: string, fromDirectory: string): string | undefined => {
	let searchDirectory = fromDirectory;

	while (searchDirectory.startsWith(repositoryRoot)) {
		const candidate = join(searchDirectory, "node_modules", packageName, "package.json");

		if (existsSync(candidate)) {
			return realpathSync(candidate);
		}

		const parent = dirname(searchDirectory);
		if (parent === searchDirectory) {
			break;
		}
		searchDirectory = parent;
	}

	return undefined;
};

const dependencyNamesForWorkspace = (
	relativeWorkspacePath: string,
	extraPackageNames: ReadonlyArray<string>,
): ReadonlySet<string> => {
	if (isAbsolute(relativeWorkspacePath)) {
		throw new Error("--workspace must be relative to the repository root.");
	}

	const workspaceDirectory = resolve(repositoryRoot, relativeWorkspacePath);
	if (!workspaceDirectory.startsWith(`${repositoryRoot}/`)) {
		throw new Error("--workspace must stay within the repository root.");
	}

	const workspaceManifestPath = join(workspaceDirectory, "package.json");
	if (!existsSync(workspaceManifestPath)) {
		throw new Error(`Workspace manifest not found: ${workspaceManifestPath}`);
	}

	const packageNames = new Set<string>();
	const visitedManifests = new Set<string>();
	const queue: Array<{ readonly manifestPath: string; readonly includeDevDependencies: boolean }> = [
		{ manifestPath: realpathSync(workspaceManifestPath), includeDevDependencies: true },
	];

	for (const packageName of extraPackageNames) {
		const manifestPath = findInstalledManifest(packageName, repositoryRoot);
		if (manifestPath === undefined) {
			throw new Error(`Included package is not installed: ${packageName}`);
		}
		packageNames.add(packageName);
		queue.push({ manifestPath, includeDevDependencies: false });
	}

	while (queue.length > 0) {
		const entry = queue.shift();
		if (entry === undefined || visitedManifests.has(entry.manifestPath)) {
			continue;
		}

		visitedManifests.add(entry.manifestPath);
		const manifest = readManifest(entry.manifestPath);
		const dependencyGroups = [
			manifest.dependencies,
			manifest.optionalDependencies,
			manifest.peerDependencies,
			...(entry.includeDevDependencies ? [manifest.devDependencies] : []),
		];

		for (const packageName of dependencyGroups.flatMap((group) => Object.keys(group ?? {}))) {
			const dependencyManifest = findInstalledManifest(packageName, dirname(entry.manifestPath));
			if (dependencyManifest === undefined) {
				continue;
			}

			const dependency = readManifest(dependencyManifest);
			packageNames.add(dependency.name ?? packageName);
			queue.push({
				manifestPath: dependencyManifest,
				includeDevDependencies: dependencyManifest.startsWith(`${repositoryRoot}/packages/`),
			});
		}
	}

	return packageNames;
};

const auditedPackageNames =
	workspacePath === undefined
		? undefined
		: dependencyNamesForWorkspace(workspacePath, includedPackageNames as ReadonlyArray<string>);

const audit = spawnSync("bun", ["audit", "--json", "--audit-level=moderate"], {
	encoding: "utf8",
	stdio: ["ignore", "pipe", "pipe"],
});

if (audit.status === 0) {
	console.log("Release dependency audit passed.");
	process.exit(0);
}

const jsonStart = audit.stdout.indexOf("{");

if (jsonStart === -1) {
	throw new Error(`Could not parse bun audit JSON output:\n${audit.stdout}\n${audit.stderr}`);
}

const report = JSON.parse(audit.stdout.slice(jsonStart)) as AuditReport;
const failures: Array<string> = [];

for (const [packageName, advisories] of Object.entries(report)) {
	if (auditedPackageNames !== undefined && !auditedPackageNames.has(packageName)) {
		continue;
	}

	for (const advisory of advisories) {
		if (severityRank[advisory.severity] >= severityRank.moderate) {
			failures.push(`${packageName}: ${advisory.severity} - ${advisory.title} (${advisory.url})`);
		}
	}
}

if (failures.length > 0) {
	throw new Error(`Release dependency audit failed:\n${failures.join("\n")}`);
}

console.log(
	workspacePath === undefined
		? "Release dependency audit passed."
		: `Release dependency audit passed for ${workspacePath}.`,
);
