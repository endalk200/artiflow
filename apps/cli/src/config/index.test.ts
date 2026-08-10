import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import {
	ArtiflowConfig,
	BASE_URL_ENV,
	CONFIG_PATH_ENV,
	DEFAULT_BASE_URL,
	loadArtiflowConfigFromEnvironment,
	parseBaseUrlEnv,
	resolveConfigPath,
} from "./index.js";

const fileSystemLayer = (files: Record<string, string>) =>
	FileSystem.layerNoop({
		exists: (path) => Effect.succeed(Object.hasOwn(files, String(path))),
		readFileString: (path) => Effect.succeed(files[String(path)] ?? ""),
	});

describe("Artiflow CLI configuration", () => {
	it.effect("loads the built-in base URL when the config file is missing", () =>
		Effect.gen(function* () {
			const config = yield* loadArtiflowConfigFromEnvironment({});
			assert.deepStrictEqual(config, { baseUrl: DEFAULT_BASE_URL, telemetryEnabled: true });
		}).pipe(Effect.provide(fileSystemLayer({}))),
	);

	it.effect("loads persisted base_url and telemetry settings", () =>
		Effect.gen(function* () {
			const path = "/tmp/artiflow-config-test.toml";
			const config = yield* loadArtiflowConfigFromEnvironment({
				[CONFIG_PATH_ENV]: path,
			});
			assert.deepStrictEqual(config, {
				baseUrl: "https://artiflow.test",
				telemetryEnabled: false,
			});
		}).pipe(
			Effect.provide(
				fileSystemLayer({
					"/tmp/artiflow-config-test.toml": 'base_url = "https://artiflow.test/"\ntelemetry = false',
				}),
			),
		),
	);

	it.effect("prefers ARTIFLOW_BASE_URL over the file", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* parseBaseUrlEnv(undefined), undefined);
			const config = yield* loadArtiflowConfigFromEnvironment({
				[BASE_URL_ENV]: "http://127.0.0.1:4000/",
				[CONFIG_PATH_ENV]: "/tmp/artiflow-config-test.toml",
			});
			assert.strictEqual(config.baseUrl, "http://127.0.0.1:4000");
			assert.isFalse(config.telemetryEnabled);
		}).pipe(
			Effect.provide(
				fileSystemLayer({
					"/tmp/artiflow-config-test.toml": 'base_url = "not-a-url"\ntelemetry = false',
				}),
			),
		),
	);

	it.effect("rejects invalid URLs and empty config paths", () =>
		Effect.gen(function* () {
			for (const value of [
				"not-a-url",
				"http://artiflow.example",
				"ftp://artiflow.example",
				"https://user:password@artiflow.example",
				"https://artiflow.example?token=unsafe",
			]) {
				const invalidUrl = yield* Effect.flip(parseBaseUrlEnv(value));
				assert.strictEqual(invalidUrl._tag, "InvalidBaseUrl");
			}
			const invalidPath = yield* Effect.flip(resolveConfigPath({ [CONFIG_PATH_ENV]: "   " }));
			assert.strictEqual(invalidPath._tag, "InvalidConfigPath");
		}),
	);

	it.effect("allows HTTPS and loopback HTTP base URLs", () =>
		Effect.gen(function* () {
			assert.strictEqual(yield* parseBaseUrlEnv("https://artiflow.example/"), "https://artiflow.example");
			assert.strictEqual(yield* parseBaseUrlEnv("http://localhost:3000/"), "http://localhost:3000");
			assert.strictEqual(yield* parseBaseUrlEnv("http://[::1]:3000/"), "http://[::1]:3000");
		}),
	);

	it.effect("rejects a non-boolean telemetry setting", () =>
		Effect.gen(function* () {
			const path = "/tmp/artiflow-config-test.toml";
			const error = yield* Effect.flip(
				loadArtiflowConfigFromEnvironment({
					[CONFIG_PATH_ENV]: path,
				}),
			);
			assert.strictEqual(error._tag, "ConfigFileParseError");
			if (error._tag === "ConfigFileParseError") {
				assert.strictEqual(error.message, "telemetry must be a boolean.");
			}
		}).pipe(
			Effect.provide(
				fileSystemLayer({
					"/tmp/artiflow-config-test.toml": 'telemetry = "disabled"',
				}),
			),
		),
	);

	it.effect("provides the resolved service through an Effect layer", () =>
		Effect.gen(function* () {
			const config = yield* ArtiflowConfig;
			assert.strictEqual(config.baseUrl, DEFAULT_BASE_URL);
			assert.isTrue(config.telemetryEnabled);
		}).pipe(Effect.provide(ArtiflowConfig.layerFromEnvironment({})), Effect.provide(fileSystemLayer({}))),
	);
});
