import { homedir } from "node:os";
import { resolve } from "node:path";
import { Context, Data, Effect, FileSystem, Layer } from "effect";
import * as Toml from "toml";

export const DEFAULT_BASE_URL = "http://localhost:3000";
export const DEFAULT_CONFIG_PATH = "~/.artiflow/config.toml";
export const BASE_URL_ENV = "ARTIFLOW_BASE_URL";
export const CONFIG_PATH_ENV = "ARTIFLOW_CONFIG_PATH";

export type ArtiflowConfiguration = {
	readonly baseUrl: string;
};

export const defaultArtiflowConfiguration: ArtiflowConfiguration = {
	baseUrl: DEFAULT_BASE_URL,
};

export class InvalidBaseUrl extends Data.TaggedError("InvalidBaseUrl")<{
	readonly value: string;
}> {}

export class InvalidConfigPath extends Data.TaggedError("InvalidConfigPath")<{
	readonly value: string;
}> {}

export class ConfigFileParseError extends Data.TaggedError("ConfigFileParseError")<{
	readonly cause: unknown;
	readonly message: string;
	readonly path: string;
}> {}

export class ConfigFileReadError extends Data.TaggedError("ConfigFileReadError")<{
	readonly cause: unknown;
	readonly message: string;
	readonly path: string;
}> {}

export type ConfigError = ConfigFileParseError | ConfigFileReadError | InvalidBaseUrl | InvalidConfigPath;

export type ConfigPathResolution = {
	readonly path: string;
	readonly source: "default" | "env";
};

const normalizeUrl = (url: URL): string => url.toString().replace(/\/$/, "");

export const parseBaseUrlEnv = (value: string | undefined): Effect.Effect<string | undefined, InvalidBaseUrl> => {
	if (value === undefined) return Effect.succeed(undefined);
	return Effect.try({
		try: () => normalizeUrl(new URL(value)),
		catch: () => new InvalidBaseUrl({ value }),
	});
};

const expandHome = (path: string) =>
	path === "~" ? homedir() : path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);

export const resolveConfigPath = (
	env: Record<string, string | undefined> = process.env,
): Effect.Effect<ConfigPathResolution, InvalidConfigPath> =>
	Effect.suspend(() => {
		const configuredPath = env[CONFIG_PATH_ENV];
		if (configuredPath !== undefined && configuredPath.trim() === "") {
			return Effect.fail(new InvalidConfigPath({ value: configuredPath }));
		}
		return Effect.succeed({
			path: expandHome(configuredPath ?? DEFAULT_CONFIG_PATH),
			source: configuredPath === undefined ? "default" : "env",
		});
	});

const readFileBaseUrl = (path: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs.exists(path).pipe(
			Effect.mapError(
				(cause) =>
					new ConfigFileReadError({
						cause,
						message: String(cause),
						path,
					}),
			),
		);
		if (!exists) return undefined;
		const source = yield* fs.readFileString(path).pipe(
			Effect.mapError(
				(cause) =>
					new ConfigFileReadError({
						cause,
						message: String(cause),
						path,
					}),
			),
		);
		const parsed = yield* Effect.try({
			try: () => Toml.parse(source) as { readonly base_url?: unknown },
			catch: (cause) =>
				new ConfigFileParseError({
					cause,
					message: cause instanceof Error ? cause.message : String(cause),
					path,
				}),
		});
		if (parsed.base_url === undefined) return undefined;
		if (typeof parsed.base_url !== "string") {
			return yield* new ConfigFileParseError({
				cause: parsed.base_url,
				message: "base_url must be a string.",
				path,
			});
		}
		return yield* parseBaseUrlEnv(parsed.base_url);
	});

export const loadArtiflowConfigFromEnvironment = (
	env: Record<string, string | undefined>,
): Effect.Effect<ArtiflowConfiguration, ConfigError, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const override = yield* parseBaseUrlEnv(env[BASE_URL_ENV]);
		if (override !== undefined) return { baseUrl: override };
		const path = yield* resolveConfigPath(env);
		const fileBaseUrl = yield* readFileBaseUrl(path.path);
		return { baseUrl: fileBaseUrl ?? DEFAULT_BASE_URL };
	});

export const loadArtiflowConfig = loadArtiflowConfigFromEnvironment(process.env);

export class ArtiflowConfig extends Context.Service<ArtiflowConfig, ArtiflowConfiguration>()("ArtiflowConfig") {
	static readonly layer = Layer.effect(ArtiflowConfig)(loadArtiflowConfig);
	static readonly layerFromEnvironment = (env: Record<string, string | undefined>) =>
		Layer.effect(ArtiflowConfig)(loadArtiflowConfigFromEnvironment(env));
}

export const formatConfigError = (error: ConfigError): string => {
	switch (error._tag) {
		case "ConfigFileParseError":
			return `Could not parse Artiflow config at ${error.path}: ${error.message}`;
		case "ConfigFileReadError":
			return `Could not read Artiflow config at ${error.path}: ${error.message}`;
		case "InvalidBaseUrl":
			return `Invalid ${BASE_URL_ENV} or base_url value "${error.value}". Expected an absolute URL.`;
		case "InvalidConfigPath":
			return `Invalid ${CONFIG_PATH_ENV} value "${error.value}". Expected a non-empty path.`;
	}
};
