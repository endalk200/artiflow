import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import * as PlatformError from "effect/PlatformError";

import {
	CONFIG_PATH_ENV,
	DEFAULT_OTLP_HTTP_ENDPOINT,
	initArtiflowConfigFromEnvironment,
	ArtiflowConfig,
	loadArtiflowConfigFromEnvironment,
	OTLP_ENDPOINT_ENV,
	parseTelemetryEnabledEnv,
	parseTelemetryEndpointEnv,
	resolveConfigPath,
	TELEMETRY_ENV,
	validateArtiflowConfigFromEnvironment,
} from "./index.js";

const fileSystemLayer = (files: Record<string, string>) =>
	FileSystem.layerNoop({
		exists: (path) => Effect.succeed(Object.hasOwn(files, String(path))),
		readFileString: (path) => Effect.succeed(files[String(path)] ?? ""),
		makeDirectory: () => Effect.void,
		writeFileString: (path, data) =>
			Effect.sync(() => {
				files[String(path)] = data;
			}),
	});

describe("Artiflow CLI configuration", () => {
	it.effect("loads built-in defaults when the default config file is missing", () =>
		Effect.gen(function* () {
			const config = yield* loadArtiflowConfigFromEnvironment({});

			assert.deepStrictEqual(config, {
				telemetry: {
					enabled: false,
					otlpEndpoint: DEFAULT_OTLP_HTTP_ENDPOINT,
				},
			});
		}).pipe(Effect.provide(fileSystemLayer({}))),
	);

	it.effect("uses env overrides before TOML file values", () =>
		Effect.gen(function* () {
			const config = yield* loadArtiflowConfigFromEnvironment({
				[CONFIG_PATH_ENV]: "/tmp/artiflow-config-test.toml",
				[OTLP_ENDPOINT_ENV]: "http://127.0.0.1:4318/",
			});

			assert.deepStrictEqual(config.telemetry, {
				enabled: true,
				otlpEndpoint: "http://127.0.0.1:4318",
			});
		}).pipe(
			Effect.provide(
				fileSystemLayer({
					"/tmp/artiflow-config-test.toml": `[telemetry]
enabled = true
otlp_endpoint = "http://localhost:9999"
`,
				}),
			),
		),
	);

	it.effect("keeps ARTIFLOW_TELEMETRY strict", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* parseTelemetryEnabledEnv("true"), true);
			assert.strictEqual(yield* parseTelemetryEnabledEnv("false"), false);

			const invalid = yield* Effect.flip(parseTelemetryEnabledEnv("1"));

			assert.strictEqual(invalid._tag, "InvalidTelemetryEnvironment");
		}),
	);

	it.effect("parses ARTIFLOW_OTLP_ENDPOINT as an absolute URL override", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* parseTelemetryEndpointEnv(undefined), undefined);
			assert.strictEqual(yield* parseTelemetryEndpointEnv("http://127.0.0.1:4318/"), "http://127.0.0.1:4318");

			const invalid = yield* Effect.flip(parseTelemetryEndpointEnv("not-a-url"));

			assert.strictEqual(invalid._tag, "InvalidTelemetryEndpoint");
		}),
	);

	it.effect("rejects whitespace-only config paths", () =>
		Effect.gen(function* () {
			const invalid = yield* Effect.flip(resolveConfigPath({ [CONFIG_PATH_ENV]: "   " }));

			assert.strictEqual(invalid._tag, "InvalidConfigPath");
			assert.strictEqual(invalid.value, "   ");
		}),
	);

	it.effect("reports invalid file and env sources separately", () =>
		Effect.gen(function* () {
			const report = yield* validateArtiflowConfigFromEnvironment({
				[CONFIG_PATH_ENV]: "/tmp/artiflow-invalid-config-test.toml",
				[TELEMETRY_ENV]: "1",
			});

			assert.strictEqual(report.file._tag, "invalid");
			assert.strictEqual(report.env._tag, "invalid");
			assert.strictEqual(report.effective._tag, "invalid");
		}).pipe(
			Effect.provide(
				fileSystemLayer({
					"/tmp/artiflow-invalid-config-test.toml": `[telemetry]
enabled = true
otlp_endpoint = "not-a-url"
`,
				}),
			),
		),
	);

	it.effect("does not hide an invalid file source behind valid env overrides during validation", () =>
		Effect.gen(function* () {
			const report = yield* validateArtiflowConfigFromEnvironment({
				[CONFIG_PATH_ENV]: "/tmp/artiflow-invalid-lower-precedence.toml",
				[OTLP_ENDPOINT_ENV]: "http://127.0.0.1:4318",
			});

			assert.strictEqual(report.file._tag, "invalid");
			assert.strictEqual(report.env._tag, "valid");
			assert.strictEqual(report.effective._tag, "valid");
		}).pipe(
			Effect.provide(
				fileSystemLayer({
					"/tmp/artiflow-invalid-lower-precedence.toml": `[telemetry]
enabled = true
otlp_endpoint = "not-a-url"
`,
				}),
			),
		),
	);

	it.effect("provides the resolved service through an Effect layer", () =>
		Effect.gen(function* () {
			const config = yield* ArtiflowConfig;

			assert.strictEqual(config.telemetry.enabled, false);
		}).pipe(Effect.provide(ArtiflowConfig.layerFromEnvironment({})), Effect.provide(fileSystemLayer({}))),
	);

	it.effect("initializes a starter config file without overwriting", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const env = { [CONFIG_PATH_ENV]: "/tmp/artiflow-init-config-test.toml" };
			const path = yield* initArtiflowConfigFromEnvironment(env).pipe(Effect.provide(fileSystemLayer(files)));

			assert.strictEqual(path.path, "/tmp/artiflow-init-config-test.toml");
			assert.include(files["/tmp/artiflow-init-config-test.toml"] ?? "", "[telemetry]");

			const alreadyExists = yield* Effect.flip(
				initArtiflowConfigFromEnvironment(env).pipe(Effect.provide(fileSystemLayer(files))),
			);

			assert.strictEqual(alreadyExists._tag, "ConfigFileAlreadyExists");
		}),
	);

	it.effect("maps config init filesystem failures to config write errors", () =>
		Effect.gen(function* () {
			const path = "/tmp/artiflow-init-write-failure.toml";
			const cause = PlatformError.systemError({
				_tag: "PermissionDenied",
				module: "FileSystem",
				method: "makeDirectory",
				pathOrDescriptor: "/tmp",
			});

			const failure = yield* Effect.flip(
				initArtiflowConfigFromEnvironment({ [CONFIG_PATH_ENV]: path }).pipe(
					Effect.provide(
						FileSystem.layerNoop({
							exists: () => Effect.succeed(false),
							makeDirectory: () => Effect.fail(cause),
						}),
					),
				),
			);

			assert.strictEqual(failure._tag, "ConfigFileWriteError");
			if (failure._tag !== "ConfigFileWriteError") {
				return;
			}
			assert.strictEqual(failure.path, path);
			assert.include(failure.message, "PermissionDenied");
		}),
	);
});
