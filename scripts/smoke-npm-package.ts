import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = join(import.meta.dirname, "..");
const cliRoot = join(repoRoot, "apps", "cli");
const packageJson = (await Bun.file(join(cliRoot, "package.json")).json()) as { readonly version: string };
const requestedTarballPath = process.argv[2];
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

try {
	let tarballPath = requestedTarballPath;
	let packedFilename = requestedTarballPath === undefined ? undefined : basename(requestedTarballPath);

	if (tarballPath === undefined) {
		const packOutput = run("npm", ["pack", "--json", "--pack-destination", smokeRoot, cliRoot], repoRoot);
		const [packedPackage] = JSON.parse(packOutput) as Array<{
			readonly filename: string;
		}>;

		if (packedPackage === undefined) {
			throw new Error("npm pack did not return a package.");
		}

		tarballPath = join(smokeRoot, packedPackage.filename);
		packedFilename = packedPackage.filename;
	}

	if (tarballPath === undefined || packedFilename === undefined) {
		throw new Error("Could not resolve an npm package tarball for smoke testing.");
	}

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

	const rootHelp = run(binPath, ["--help"], smokeRoot);

	for (const command of ["project", "publish", "artifact", "version"]) {
		if (!rootHelp.includes(command)) {
			throw new Error(`Expected artiflow --help to include the ${command} command.`);
		}
	}

	const projectHelp = run(binPath, ["project", "--help"], smokeRoot);

	for (const command of ["create", "link", "show", "rename", "unlink", "delete"]) {
		if (!projectHelp.includes(command)) {
			throw new Error(`Expected artiflow project --help to include the ${command} command.`);
		}
	}

	console.log(`Smoke-tested artiflow@${packageJson.version} from ${packedFilename}.`);
} finally {
	await rm(smokeRoot, { force: true, recursive: true });
}
