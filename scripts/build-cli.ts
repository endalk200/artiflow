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

const result = spawnSync(
	join(repoRoot, "node_modules", ".bin", "esbuild"),
	[
		join(cliRoot, "src", "bin.ts"),
		"--bundle",
		"--platform=node",
		"--format=esm",
		"--target=node22",
		'--banner:js=import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
		`--outfile=${join(distDirectory, "bin.js")}`,
	],
	{ cwd: repoRoot, encoding: "utf8", stdio: "inherit" },
);

if (result.error !== undefined) {
	console.error(`Could not start esbuild: ${result.error.message}`);
	process.exit(1);
}

if (result.status !== 0) process.exit(result.status ?? 1);

await chmod(join(distDirectory, "bin.js"), 0o755);
