import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { ArtiflowApiClient, type ArtiflowApiClientShape } from "./api-client.js";
import { InvalidRequest } from "@app/api-contract/models";
import { assert, describe, it } from "@effect/vitest";
import { CONFIG_PATH_ENV, BASE_URL_ENV, InvalidConfigPath } from "./config/index.js";
import { Effect, FileSystem, Layer, Path, Runtime, Stdio, Terminal } from "effect";
import { TestConsole } from "effect/testing";
import { CliOutput } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";
import { runCliWithArgs } from "./cli/run.js";
import { CLI_EXIT_CODES, handleCliFailure } from "./runtime/failures.js";
import { withoutConsoleLogger } from "./runtime/telemetry.js";

const require = createRequire(import.meta.url);
const cliPackage = require("../package.json") as { readonly version: string };
const legacyArtiflowSkill = readFileSync(new URL("./fixtures/legacy-artiflow-skill.md", import.meta.url), "utf8");

const TerminalLayer = Layer.succeed(
	Terminal.Terminal,
	Terminal.make({
		columns: Effect.succeed(80),
		rows: Effect.succeed(24),
		display: () => Effect.void,
		readInput: Effect.die("readInput is not implemented in CLI tests"),
		readLine: Effect.succeed(""),
	}),
);

const SpawnerLayer = Layer.succeed(
	ChildProcessSpawner.ChildProcessSpawner,
	ChildProcessSpawner.make(() => Effect.die("Child process spawning is not implemented in CLI tests")),
);

const cliTestLayer = (
	files: Record<string, string> = {},
	client: ArtiflowApiClientShape = {} as ArtiflowApiClientShape,
) =>
	Layer.mergeAll(
		TestConsole.layer,
		FileSystem.layerNoop({
			exists: (path) => Effect.succeed(Object.hasOwn(files, String(path))),
			readFileString: (path) => Effect.succeed(files[String(path)] ?? ""),
			makeDirectory: () => Effect.void,
			writeFileString: (path, data) =>
				Effect.sync(() => {
					files[String(path)] = data;
				}),
		}),
		Path.layer,
		TerminalLayer,
		CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
		SpawnerLayer,
		Stdio.layerTest({}),
		withoutConsoleLogger,
		Layer.succeed(ArtiflowApiClient, client),
	);

const artiflowEnvKeys = [BASE_URL_ENV, CONFIG_PATH_ENV] as const;

const withIsolatedArtiflowEnvironment = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.suspend(() => {
		const previous = Object.fromEntries(artiflowEnvKeys.map((key) => [key, process.env[key]]));

		for (const key of artiflowEnvKeys) {
			delete process.env[key];
		}

		return effect.pipe(
			Effect.ensuring(
				Effect.sync(() => {
					for (const key of artiflowEnvKeys) {
						const value = previous[key];
						if (value === undefined) {
							delete process.env[key];
						} else {
							process.env[key] = value;
						}
					}
				}),
			),
		);
	});

const captureArtiflowCommand = (args: ReadonlyArray<string>) =>
	Effect.gen(function* () {
		yield* runCliWithArgs(args);

		return {
			stdout: yield* TestConsole.logLines,
			stderr: yield* TestConsole.errorLines,
		};
	});

const runArtiflowCommand = (
	args: ReadonlyArray<string>,
	files: Record<string, string> = {},
	client: ArtiflowApiClientShape = {} as ArtiflowApiClientShape,
) => captureArtiflowCommand(args).pipe(withIsolatedArtiflowEnvironment, Effect.provide(cliTestLayer(files, client)));

const runArtiflowCommands = (
	commands: ReadonlyArray<ReadonlyArray<string>>,
	files: Record<string, string> = {},
	client: ArtiflowApiClientShape = {} as ArtiflowApiClientShape,
) =>
	Effect.forEach(commands, captureArtiflowCommand).pipe(
		withIsolatedArtiflowEnvironment,
		Effect.provide(cliTestLayer(files, client)),
	);

type SkillInstallResult = {
	readonly paths: ReadonlyArray<string>;
	readonly scope: "global" | "project";
	readonly status: "installed" | "unchanged" | "updated";
};

const parseLastResult = (stdout: ReadonlyArray<unknown>): SkillInstallResult =>
	JSON.parse(String(stdout.at(-1) ?? "")) as SkillInstallResult;

describe("artiflow CLI", () => {
	it.effect("prints root help and succeeds when invoked without arguments", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand([]);
			const stdoutText = stdout.join("\n");

			assert.include(stdoutText, "artiflow <subcommand> [flags]");
			assert.include(stdoutText, "Publish agent-authored visual documents");
			assert.include(stdoutText, "project");
			assert.include(stdoutText, "publish");
			assert.include(stdoutText, "artifact");
			assert.include(stdoutText, "skill");
			assert.include(stdoutText, "version");
		}),
	);

	it.effect("prints the package version with the version command", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand(["version"]);

			assert.deepStrictEqual(stdout, [cliPackage.version]);
		}),
	);

	it.effect("creates a Project, writes the committed manifest, and emits one JSON value", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const client = {
				projects: {
					create: () =>
						Effect.succeed({
							createdAt: "2026-07-16T12:00:00.000Z",
							id: "prj_cli",
							name: "CLI project",
							updatedAt: "2026-07-16T12:00:00.000Z",
						}),
				},
			} as unknown as ArtiflowApiClientShape;
			const { stdout } = yield* runArtiflowCommand(["project", "create", "CLI project", "--json"], files, client);

			assert.strictEqual(stdout.length, 1);
			assert.deepInclude(JSON.parse(String(stdout[0] ?? "")), { id: "prj_cli", name: "CLI project" });
			const manifestPath = Object.keys(files).find((path) => path.endsWith("/.artiflow/project.json"));
			assert.deepStrictEqual(JSON.parse(files[manifestPath ?? ""] ?? ""), {
				projectId: "prj_cli",
				schemaVersion: 1,
			});
		}),
	);

	it.effect("publishes Artifact Source through a linked Project and preserves the machine response shape", () =>
		Effect.gen(function* () {
			const cwd = process.cwd().replaceAll("\\", "/");
			const files: Record<string, string> = {
				[`${cwd}/.artiflow/project.json`]: '{"schemaVersion":1,"projectId":"prj_cli"}',
				[`${cwd}/report.mdx`]: "---\ntitle: CLI report\n---\n\n# Report",
			};
			const client = {
				projects: {
					createArtifact: () =>
						Effect.succeed({
							artifactId: "art_cli",
							projectId: "prj_cli",
							revisionId: "rev_cli",
							revisionNumber: 1,
							url: "http://localhost:3000/artifacts/art_cli",
						}),
				},
			} as unknown as ArtiflowApiClientShape;
			const { stdout } = yield* runArtiflowCommand(["publish", "report.mdx", "--json"], files, client);

			assert.deepStrictEqual(JSON.parse(String(stdout[0] ?? "")), {
				artifactId: "art_cli",
				projectId: "prj_cli",
				revisionId: "rev_cli",
				revisionNumber: 1,
				url: "http://localhost:3000/artifacts/art_cli",
			});
		}),
	);

	it.effect("installs the explicit-only agent Skill for the current project by default", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const { stdout } = yield* runArtiflowCommand(["skill", "install", "--json"], files);
			const result = parseLastResult(stdout);
			const normalizedPaths = result.paths.map((path) => path.replaceAll("\\", "/"));
			const cwd = process.cwd().replaceAll("\\", "/");

			assert.strictEqual(result.scope, "project");
			assert.strictEqual(result.status, "installed");
			assert.deepStrictEqual(normalizedPaths, [
				`${cwd}/.agents/skills/artiflow/SKILL.md`,
				`${cwd}/.agents/skills/artiflow/agents/openai.yaml`,
				`${cwd}/.claude/skills/artiflow/SKILL.md`,
				`${cwd}/.claude/skills/artiflow/agents/openai.yaml`,
			]);
			for (const path of result.paths.filter((path) => path.endsWith("SKILL.md"))) {
				const skill = files[path] ?? "";
				assert.include(skill, "disable-model-invocation: true");
				assert.include(skill, 'opencode/autoinvoke: "false"');
				assert.include(skill, 'artiflow/managed: "true"');
				assert.include(skill, "Top-level imports and exports are unsupported.");
				assert.include(skill, "the agent's browser capability when one is available");
			}
			for (const path of result.paths.filter((path) => path.endsWith("openai.yaml"))) {
				assert.include(files[path] ?? "", "allow_implicit_invocation: false");
			}
		}),
	);

	it.effect("installs the agent Skill globally and reports unchanged repeat installations", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const [first, second] = yield* runArtiflowCommands(
				[
					["skill", "install", "--global", "--json"],
					["skill", "install", "--global", "--json"],
				],
				files,
			);
			if (first === undefined || second === undefined) {
				return assert.fail("Expected both Skill installation command results.");
			}
			const firstResult = parseLastResult(first.stdout);
			const secondResult = parseLastResult(second.stdout);

			assert.strictEqual(firstResult.scope, "global");
			assert.strictEqual(firstResult.status, "installed");
			assert.strictEqual(secondResult.status, "unchanged");
			assert.isTrue(firstResult.paths.some((path) => path.replaceAll("\\", "/").includes("/.agents/skills/")));
			assert.isTrue(firstResult.paths.some((path) => path.replaceAll("\\", "/").includes("/.claude/skills/")));
		}),
	);

	it.effect("updates the legacy generated Skill without requiring force", () =>
		Effect.gen(function* () {
			const cwd = process.cwd().replaceAll("\\", "/");
			const skillPath = `${cwd}/.agents/skills/artiflow/SKILL.md`;
			const files: Record<string, string> = { [skillPath]: legacyArtiflowSkill.replaceAll("\n", "\r\n") };

			const { stdout } = yield* runArtiflowCommand(["skill", "install", "--json"], files);
			assert.strictEqual(parseLastResult(stdout).status, "updated");
			assert.include(files[skillPath] ?? "", 'artiflow/managed: "true"');
		}),
	);

	it.effect("protects an unrecognized existing Skill unless force is explicit", () =>
		Effect.gen(function* () {
			const cwd = process.cwd().replaceAll("\\", "/");
			const skillPath = `${cwd}/.agents/skills/artiflow/SKILL.md`;
			const customSkill = `---
name: artiflow
description: Custom
---

This documentation mentions artiflow/managed: "true" but does not opt into managed updates.
`;
			const files: Record<string, string> = { [skillPath]: customSkill };

			const error = yield* Effect.flip(runArtiflowCommand(["skill", "install", "--json"], files));
			assert.strictEqual(error._tag, "SkillInstallError");
			assert.include(error.message, "--force");
			assert.strictEqual(files[skillPath], customSkill);

			const { stdout } = yield* runArtiflowCommand(["skill", "install", "--force", "--json"], files);
			const result = parseLastResult(stdout);
			assert.strictEqual(result.status, "updated");
			assert.include(files[skillPath] ?? "", 'artiflow/managed: "true"');
		}),
	);

	it.effect("protects an unmanaged invocation-policy file when no Skill owns its directory", () =>
		Effect.gen(function* () {
			const cwd = process.cwd().replaceAll("\\", "/");
			const metadataPath = `${cwd}/.agents/skills/artiflow/agents/openai.yaml`;
			const files: Record<string, string> = { [metadataPath]: "custom: policy\n" };

			const error = yield* Effect.flip(runArtiflowCommand(["skill", "install", "--json"], files));
			if (error._tag !== "SkillInstallError") return assert.fail(`Expected SkillInstallError, received ${error._tag}`);
			assert.strictEqual(error.path.replaceAll("\\", "/"), metadataPath);
			assert.strictEqual(files[metadataPath], "custom: policy\n");
		}),
	);

	it.effect("prints CLI failures to stderr through the failure reporting module", () =>
		Effect.gen(function* () {
			const error = new InvalidConfigPath({ value: "" });
			const failure = yield* Effect.flip(handleCliFailure.InvalidConfigPath(error));

			const stderr = yield* TestConsole.errorLines;

			assert.deepStrictEqual(stderr, ['Invalid ARTIFLOW_CONFIG_PATH value "". Expected a non-empty path.']);
			assert.strictEqual(Runtime.getErrorExitCode(failure), CLI_EXIT_CODES.invalidInput);
		}).pipe(Effect.provide(TestConsole.layer)),
	);

	it.effect("classifies malformed API requests as invalid input", () =>
		Effect.gen(function* () {
			const error = new InvalidRequest({
				location: "payload",
				message: "Request payload does not match the API contract.",
			});
			const failure = yield* Effect.flip(handleCliFailure.InvalidRequest(error));

			assert.deepStrictEqual(yield* TestConsole.errorLines, [error.message]);
			assert.strictEqual(Runtime.getErrorExitCode(failure), CLI_EXIT_CODES.invalidInput);
		}).pipe(Effect.provide(TestConsole.layer)),
	);
});
