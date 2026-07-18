import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const cliRoot = join(repoRoot, "apps", "cli");
const npmCache = join(tmpdir(), "artiflow-npm-cache");
const expectedFiles = ["dist/bin.js", "LICENSE", "package.json", "README.md"].sort();
const requestedOutputDirectory = process.argv[2];
const outputDirectory = requestedOutputDirectory ?? (await mkdtemp(join(tmpdir(), "artiflow-cli-verify-")));

const packageJson = (await Bun.file(join(cliRoot, "package.json")).json()) as {
	readonly dependencies?: Record<string, string>;
	readonly optionalDependencies?: Record<string, string>;
	readonly peerDependencies?: Record<string, string>;
	readonly private?: boolean;
	readonly version?: string;
};

if (packageJson.private === true) {
	throw new Error("artiflow must not be private when preparing the npm package.");
}

const dependencyFields = {
	dependencies: packageJson.dependencies,
	optionalDependencies: packageJson.optionalDependencies,
	peerDependencies: packageJson.peerDependencies,
} as const;
const presentDependencyFields = Object.entries(dependencyFields)
	.filter(([, dependencies]) => dependencies !== undefined && Object.keys(dependencies).length > 0)
	.map(([field]) => field);

if (presentDependencyFields.length > 0) {
	throw new Error(
		`artiflow is expected to publish without runtime npm dependencies; found ${presentDependencyFields.join(", ")}.`,
	);
}

await mkdir(outputDirectory, { recursive: true });

const pack = spawnSync("npm", ["pack", "--json", "--pack-destination", outputDirectory, cliRoot], {
	cwd: repoRoot,
	encoding: "utf8",
	env: {
		...process.env,
		NPM_CONFIG_CACHE: npmCache,
	},
	stdio: ["ignore", "pipe", "pipe"],
});

try {
	if (pack.status !== 0) {
		throw new Error(`npm pack failed:\n${pack.stderr}`);
	}

	const [packedPackage] = JSON.parse(pack.stdout) as Array<{
		readonly filename: string;
		readonly files: ReadonlyArray<{ readonly path: string }>;
		readonly version: string;
	}>;

	if (packedPackage === undefined) {
		throw new Error("npm pack did not return a package.");
	}

	if (packedPackage.version !== packageJson.version) {
		throw new Error(`Packed version ${packedPackage.version} does not match package version ${packageJson.version}.`);
	}

	const actualFiles = packedPackage.files.map((file) => file.path).sort();

	if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
		throw new Error(`Unexpected npm package files:\n${actualFiles.join("\n")}`);
	}

	console.log(
		`Verified artiflow@${packedPackage.version} package contents in ${join(outputDirectory, packedPackage.filename)}.`,
	);
} finally {
	if (requestedOutputDirectory === undefined) {
		await rm(outputDirectory, { force: true, recursive: true });
	}
}
