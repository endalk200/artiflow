import { createRequire } from "node:module";
import { assert, describe, it } from "@effect/vitest";
import {
	CONFIG_PATH_ENV,
	type ConfigValidationReport,
	InvalidConfigPath,
	OTLP_ENDPOINT_ENV,
	parseTelemetryEnabledEnv,
	parseTelemetryEndpointEnv,
	TELEMETRY_ENV,
} from "./config/index.js";
import { Effect, FileSystem, Layer, Logger, Path, Stdio, Terminal } from "effect";
import { TestConsole } from "effect/testing";
import { CliOutput } from "effect/unstable/cli";
import { ChildProcessSpawner } from "effect/unstable/process";
import { configValidationHasFailures, formatConfigValidationReport } from "./cli/commands/config/validate.cmd.js";
import { runCliWithArgs } from "./cli/run.js";
import { handleCliFailure } from "./runtime/failures.js";
import {
	DEFAULT_OTLP_HTTP_ENDPOINT,
	telemetryLayerFromConfiguration,
	withoutConsoleLogger,
} from "./runtime/telemetry.js";

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

const cliTestLayer = (files: Record<string, string> = {}) =>
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
	);

const artiflowEnvKeys = [CONFIG_PATH_ENV, TELEMETRY_ENV, OTLP_ENDPOINT_ENV] as const;

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

const runArtiflowCommand = (args: ReadonlyArray<string>, files: Record<string, string> = {}) =>
	Effect.gen(function* () {
		yield* runCliWithArgs(args);

		return {
			stdout: yield* TestConsole.logLines,
			stderr: yield* TestConsole.errorLines,
		};
	}).pipe(withIsolatedArtiflowEnvironment, Effect.provide(cliTestLayer(files)));

describe("artiflow CLI", () => {
	it.effect("prints root help and succeeds when invoked without arguments", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand([]);
			const stdoutText = stdout.join("\n");

			assert.include(stdoutText, "artiflow <subcommand> [flags]");
			assert.include(stdoutText, "Manage Artiflow configuration");
			assert.include(stdoutText, "config");
			assert.include(stdoutText, "version");
		}),
	);

	it.effect("prints the package version with the version command", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand(["version"]);

			assert.deepStrictEqual(stdout, [cliPackage.version]);
		}),
	);

	it.effect("prints the effective config path", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand(["config", "path"]);
			const normalizedPath = String(stdout[0] ?? "").replaceAll("\\", "/");

			assert.strictEqual(normalizedPath.endsWith("/.artiflow/config.toml"), true);
		}),
	);

	it.effect("validates the missing default config with defaults", () =>
		Effect.gen(function* () {
			const { stdout } = yield* runArtiflowCommand(["config", "validate"]);
			const stdoutText = stdout.join("\n");

			assert.include(stdoutText, "No config file found");
			assert.include(stdoutText, "Environment overrides are valid");
			assert.include(stdoutText, "Valid Artiflow Configuration.");
		}),
	);

	it.effect("formats config validation output and failure policy in one place", () =>
		Effect.sync(() => {
			const report: ConfigValidationReport = {
				path: { path: "/tmp/artiflow.toml", source: "env" },
				file: { _tag: "valid", message: "file ok" },
				env: { _tag: "valid", message: "env ok" },
				effective: { _tag: "invalid", message: "effective invalid" },
				config: undefined,
			};

			assert.deepStrictEqual(formatConfigValidationReport(report), ["file ok", "env ok", "effective invalid"]);
			assert.strictEqual(configValidationHasFailures(report), true);
		}),
	);

	it.effect("keeps telemetry env parsing in Artiflow Configuration", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* parseTelemetryEnabledEnv(undefined), undefined);
			assert.strictEqual(yield* parseTelemetryEnabledEnv("false"), false);
			assert.strictEqual(yield* parseTelemetryEnabledEnv("true"), true);
			assert.strictEqual(yield* parseTelemetryEndpointEnv(undefined), undefined);
			assert.strictEqual(yield* parseTelemetryEndpointEnv("http://127.0.0.1:27686/"), "http://127.0.0.1:27686");

			const invalid = yield* Effect.flip(parseTelemetryEnabledEnv("1"));

			assert.strictEqual(invalid._tag, "InvalidTelemetryEnvironment");
			assert.strictEqual(invalid.value, "1");
		}),
	);

	it.effect("builds disabled telemetry from resolved Artiflow Configuration", () =>
		Effect.gen(function* () {
			const loggers = yield* Logger.CurrentLoggers;

			assert.strictEqual(loggers.size, 0);
		}).pipe(
			Effect.provide(
				telemetryLayerFromConfiguration({
					telemetry: {
						enabled: false,
						otlpEndpoint: DEFAULT_OTLP_HTTP_ENDPOINT,
					},
				}),
			),
		),
	);

	it.effect("disables telemetry with a warning when the configured collector is unavailable", () =>
		Effect.gen(function* () {
			const previousFetch = globalThis.fetch;
			globalThis.fetch = (() => Promise.reject(new Error("collector unavailable"))) as typeof fetch;

			yield* Effect.gen(function* () {
				const loggers = yield* Logger.CurrentLoggers;
				const stderr = yield* TestConsole.errorLines;

				assert.strictEqual(loggers.size, 0);
				assert.deepStrictEqual(stderr, [
					"Warning: OTLP collector unreachable at http://127.0.0.1:65535; telemetry disabled.",
				]);
			}).pipe(
				Effect.provide(
					telemetryLayerFromConfiguration({
						telemetry: {
							enabled: true,
							otlpEndpoint: "http://127.0.0.1:65535",
						},
					}),
				),
				Effect.ensuring(
					Effect.sync(() => {
						globalThis.fetch = previousFetch;
					}),
				),
			);
		}).pipe(Effect.provide(TestConsole.layer)),
	);

	it.effect("keeps telemetry enabled when collector rejects OPTIONS with 404", () =>
		Effect.gen(function* () {
			const previousFetch = globalThis.fetch;
			globalThis.fetch = (() => Promise.resolve(new Response(null, { status: 404 }))) as typeof fetch;

			yield* Effect.gen(function* () {
				const loggers = yield* Logger.CurrentLoggers;
				const stderr = yield* TestConsole.errorLines;

				assert.strictEqual(loggers.size, 1);
				assert.deepStrictEqual(stderr, []);
			}).pipe(
				Effect.provide(
					telemetryLayerFromConfiguration({
						telemetry: {
							enabled: true,
							otlpEndpoint: "http://127.0.0.1:27686",
						},
					}),
				),
				Effect.ensuring(
					Effect.sync(() => {
						globalThis.fetch = previousFetch;
					}),
				),
			);
		}).pipe(Effect.provide(TestConsole.layer)),
	);

	it.effect("removes the default console loggers when telemetry is disabled", () =>
		Effect.gen(function* () {
			const loggers = yield* Logger.CurrentLoggers;

			assert.strictEqual(loggers.size, 0);
		}).pipe(Effect.provide(withoutConsoleLogger)),
	);

	it.effect("prints CLI failures to stderr through the failure reporting module", () =>
		Effect.gen(function* () {
			const error = new InvalidConfigPath({ value: "" });
			yield* Effect.flip(handleCliFailure.InvalidConfigPath(error));

			const stderr = yield* TestConsole.errorLines;

			assert.deepStrictEqual(stderr, ['Invalid ARTIFLOW_CONFIG_PATH value "". Expected a non-empty path.']);
		}).pipe(Effect.provide(TestConsole.layer)),
	);
});
