import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
	PINNED_NPM_PATCHES,
	PINNED_NPM_VERSION,
	validatePinnedNpmPatch,
} from "../apps/cli/src/release/pinned-npm-audit.js";

type PackageManifest = {
	readonly dependencies?: Readonly<Record<string, string>>;
	readonly name: string;
	readonly optionalDependencies?: Readonly<Record<string, string>>;
	readonly peerDependencies?: Readonly<Record<string, string>>;
	readonly version: string;
};

const requestedDirectory = process.argv[2];
if (requestedDirectory === undefined) {
	throw new Error("Usage: bun run scripts/harden-pinned-npm.ts <extracted-npm-directory>");
}

const npmDirectory = resolve(requestedDirectory);
const readManifest = async (directory: string): Promise<PackageManifest> => {
	const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as unknown;
	if (
		typeof manifest !== "object" ||
		manifest === null ||
		!("name" in manifest) ||
		!("version" in manifest) ||
		typeof manifest.name !== "string" ||
		typeof manifest.version !== "string"
	) {
		throw new Error(`Invalid package manifest in ${directory}.`);
	}
	return manifest as PackageManifest;
};

const npmManifest = await readManifest(npmDirectory);
if (npmManifest.name !== "npm" || npmManifest.version !== PINNED_NPM_VERSION) {
	throw new Error(
		`Extracted package is ${npmManifest.name}@${npmManifest.version}; expected npm@${PINNED_NPM_VERSION}.`,
	);
}

const workspace = await mkdtemp(join(tmpdir(), "artiflow-harden-npm-"));

try {
	for (const patch of PINNED_NPM_PATCHES) {
		const targetDirectory = join(npmDirectory, "node_modules", patch.packageName);
		const sourceManifest = await readManifest(targetDirectory);
		const patchDirectory = join(workspace, patch.packageName);
		await mkdir(patchDirectory, { recursive: true });

		const pack = spawnSync(
			"npm",
			[
				"pack",
				`${patch.packageName}@${patch.targetVersion}`,
				"--json",
				"--ignore-scripts",
				"--pack-destination",
				patchDirectory,
			],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		);

		if (pack.status !== 0) {
			throw new Error(`Could not pack ${patch.packageName}@${patch.targetVersion}:\n${pack.stderr}`);
		}

		const [packedPackage] = JSON.parse(pack.stdout) as Array<{
			readonly filename: string;
			readonly integrity: string;
		}>;
		if (packedPackage === undefined) {
			throw new Error(`npm pack returned no artifact for ${patch.packageName}@${patch.targetVersion}.`);
		}

		const extractDirectory = join(patchDirectory, "extracted");
		await mkdir(extractDirectory);
		const extract = spawnSync(
			"tar",
			["--extract", "--gzip", "--file", join(patchDirectory, packedPackage.filename), "--directory", extractDirectory],
			{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
		);
		if (extract.status !== 0) {
			throw new Error(`Could not extract ${patch.packageName}@${patch.targetVersion}:\n${extract.stderr}`);
		}

		const replacementDirectory = join(extractDirectory, "package");
		const replacementManifest = await readManifest(replacementDirectory);
		validatePinnedNpmPatch({
			actualIntegrity: packedPackage.integrity,
			patch,
			replacementManifest,
			sourceManifest,
		});

		await rm(targetDirectory, { recursive: true });
		await rename(replacementDirectory, targetDirectory);
		console.log(`Hardened npm with ${patch.packageName}@${patch.targetVersion}.`);
	}
} finally {
	await rm(workspace, { force: true, recursive: true });
}
