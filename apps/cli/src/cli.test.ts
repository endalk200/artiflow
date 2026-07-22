import { createRequire } from "node:module";
import { ArtiflowApiClient, type ArtiflowApiClientShape } from "./api-client.js";
import { InvalidRequest } from "@app/api-contract/models";
import { assert, describe, it } from "@effect/vitest";
import { CONFIG_PATH_ENV, BASE_URL_ENV, InvalidConfigPath } from "./config/index.js";
import { Effect, FileSystem, Layer, Path, Runtime, Stdio, Terminal } from "effect";
import { TestConsole } from "effect/testing";
import { CliOutput } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";
import { commandNameFromArgs, runCliWithArgs } from "./cli/run.js";
import { CLI_EXIT_CODES, handleCliFailure } from "./runtime/failures.js";
import { withoutConsoleLogger } from "./runtime/telemetry.js";

const require = createRequire(import.meta.url);
const cliPackage = require("../package.json") as { readonly version: string };

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

describe("artiflow CLI", () => {
	it("reduces telemetry command names to the bounded command catalog", () => {
		assert.strictEqual(commandNameFromArgs(["publish", "/private/source/report.mdx"]), "publish");
		assert.strictEqual(commandNameFromArgs(["publish", "show"]), "publish");
		assert.strictEqual(commandNameFromArgs(["project", "create", "Private project name"]), "project create");
		assert.strictEqual(commandNameFromArgs(["unknown", "publish"]), "unknown");
		assert.strictEqual(commandNameFromArgs(["publish", "--", "--version"]), "publish");
		assert.strictEqual(commandNameFromArgs(["project", "create", "--", "-v"]), "project create");
		assert.strictEqual(commandNameFromArgs(["--help"]), "help");
		assert.strictEqual(commandNameFromArgs(["publish", "--help"]), "publish help");
		assert.strictEqual(commandNameFromArgs(["project", "create", "-h"]), "project create help");
		assert.strictEqual(commandNameFromArgs(["--help", "publish"]), "publish help");
		assert.strictEqual(commandNameFromArgs(["publish", "--version", "--help"]), "publish help");
		assert.strictEqual(commandNameFromArgs(["publish", "--", "--help"]), "publish");
	});

	it.effect("prints contextual command help without running the command", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand(["publish", "--help"]);
			const stdoutText = stdout.join("\n");

			assert.include(stdoutText, "Publish MDX as a new Artifact or immutable Revision");
			assert.include(stdoutText, "artiflow publish [flags] <source>");
		}),
	);

	it.effect("prints root help and succeeds when invoked without arguments", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand([]);
			const stdoutText = stdout.join("\n");

			assert.include(stdoutText, "artiflow <subcommand> [flags]");
			assert.include(stdoutText, "Publish agent-authored visual documents");
			assert.include(stdoutText, "project");
			assert.include(stdoutText, "publish");
			assert.include(stdoutText, "artifact");
			assert.notInclude(stdoutText, "skill");
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
