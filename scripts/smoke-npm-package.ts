import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(import.meta.dirname, "..");
const cliRoot = join(repoRoot, "apps", "cli");
const packageJson = (await Bun.file(join(cliRoot, "package.json")).json()) as { readonly version: string };
const smokeRoot = await mkdtemp(join(tmpdir(), "artiflow-cli-smoke-"));
const npmCache = join(smokeRoot, ".npm-cache");

const run = (command: string, args: ReadonlyArray<string>, cwd: string) => {
	const result = spawnSync(command, [...args], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			NPM_CONFIG_CACHE: npmCache,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}\n${result.stdout}`);
	}

	return result.stdout.trim();
};

const packOutput = run("npm", ["pack", "--json", "--pack-destination", smokeRoot, cliRoot], repoRoot);
const [packedPackage] = JSON.parse(packOutput) as Array<{ readonly filename: string }>;
const tarballPath = join(smokeRoot, packedPackage.filename);

run("npm", ["init", "-y"], smokeRoot);
run("npm", ["install", tarballPath], smokeRoot);

const binPath = join(smokeRoot, "node_modules", ".bin", "artiflow");
const actualVersion = run(binPath, ["version"], smokeRoot);

if (actualVersion !== packageJson.version) {
	throw new Error(`Expected artiflow version to print ${packageJson.version}, got ${actualVersion}.`);
}

const flagVersion = run(binPath, ["--version"], smokeRoot);

if (!flagVersion.includes(packageJson.version)) {
	throw new Error(`Expected artiflow --version to include ${packageJson.version}, got ${flagVersion}.`);
}

const configPath = run(binPath, ["config", "path"], smokeRoot);

if (!configPath.endsWith("/.artiflow/config.toml")) {
	throw new Error(`Expected config path smoke test to print the default config path, got ${configPath}.`);
}

console.log(`Smoke-tested artiflow@${packageJson.version} from ${packedPackage.filename}.`);
