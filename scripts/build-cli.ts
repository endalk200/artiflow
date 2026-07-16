import { spawnSync } from "node:child_process";
import { chmod, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "./sync-cli-version.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDirectory, "..");
const cliRoot = join(repoRoot, "apps", "cli");
const distDirectory = join(cliRoot, "dist");

await rm(distDirectory, { force: true, recursive: true });

const build = spawnSync(
	"bun",
	[
		"build",
		join(cliRoot, "src", "bin.ts"),
		"--target=node",
		"--format=esm",
		"--packages=bundle",
		`--outfile=${join(distDirectory, "bin.js")}`,
	],
	{
		cwd: repoRoot,
		encoding: "utf8",
		stdio: "inherit",
	},
);

if (build.error !== undefined) {
	console.error(`Could not start Bun build: ${build.error.message}`);
	process.exit(1);
}

if (build.status !== 0) {
	process.exit(build.status ?? 1);
}

await chmod(join(distDirectory, "bin.js"), 0o755);
