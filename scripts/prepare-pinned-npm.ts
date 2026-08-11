import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

import { PINNED_NPM_VERSION } from "../apps/cli/src/release/pinned-npm-audit.js";

const requestedOutputDirectory = process.argv[2];
if (requestedOutputDirectory === undefined) {
	throw new Error("Usage: bun run scripts/prepare-pinned-npm.ts <artifact-directory>");
}

const repoRoot = join(import.meta.dirname, "..");
const outputDirectory = resolve(requestedOutputDirectory);
const officialArchive = join(outputDirectory, `npm-${PINNED_NPM_VERSION}.tgz`);
const hardenedArchive = join(outputDirectory, `npm-${PINNED_NPM_VERSION}-hardened.tgz`);
const checksumFile = join(outputDirectory, `npm-${PINNED_NPM_VERSION}.sha256`);

const run = (command: string, args: ReadonlyArray<string>, cwd = repoRoot): void => {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: "inherit",
	});
	if (result.error !== undefined) {
		throw new Error(`Could not execute ${command}: ${result.error.message}`);
	}
	if (result.status !== 0) {
		throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
	}
};

const sha256 = async (path: string): Promise<string> =>
	createHash("sha256")
		.update(await readFile(path))
		.digest("hex");

await mkdir(outputDirectory, { recursive: true });
const workspace = await mkdtemp(join(tmpdir(), "artiflow-prepare-npm-"));
const extractedDirectory = join(workspace, "extracted");

try {
	run("npm", ["pack", `npm@${PINNED_NPM_VERSION}`, "--pack-destination", outputDirectory, "--silent"]);
	await readFile(officialArchive);

	await mkdir(extractedDirectory);
	run("tar", ["--extract", "--gzip", "--file", officialArchive, "--directory", extractedDirectory]);

	const npmDirectory = join(extractedDirectory, "package");
	run(process.execPath, ["run", "scripts/harden-pinned-npm.ts", npmDirectory]);
	run("npm", ["shrinkwrap", "--ignore-scripts"], npmDirectory);
	run(process.execPath, ["run", "scripts/audit-pinned-npm.ts", npmDirectory]);
	run("tar", ["--create", "--gzip", "--file", hardenedArchive, "--directory", extractedDirectory, "package"]);

	const checksums = await Promise.all([officialArchive, hardenedArchive].map(sha256));
	await writeFile(
		checksumFile,
		[`${checksums[0]}  ${basename(officialArchive)}`, `${checksums[1]}  ${basename(hardenedArchive)}`, ""].join("\n"),
	);
	console.log(`Prepared audited npm CLI ${PINNED_NPM_VERSION} artifacts in ${outputDirectory}.`);
} finally {
	await rm(workspace, { force: true, recursive: true });
}
