import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { Config, ConfigProvider, Context, Data, Effect, FileSystem, Layer, Result } from "effect";
import * as Toml from "toml";

export const DEFAULT_OTLP_HTTP_ENDPOINT = "http://localhost:4318";
export const DEFAULT_CONFIG_PATH = "~/.artiflow/config.toml";
export const CONFIG_PATH_ENV = "ARTIFLOW_CONFIG_PATH";
export const TELEMETRY_ENV = "ARTIFLOW_TELEMETRY";
export const OTLP_ENDPOINT_ENV = "ARTIFLOW_OTLP_ENDPOINT";

export type TelemetryConfig = {
	readonly enabled: boolean;
	readonly otlpEndpoint: string;
};

export type ArtiflowConfiguration = {
	readonly telemetry: TelemetryConfig;
};

export const defaultArtiflowConfiguration: ArtiflowConfiguration = {
	telemetry: {
		enabled: false,
		otlpEndpoint: DEFAULT_OTLP_HTTP_ENDPOINT,
	},
};

export class InvalidTelemetryEnvironment extends Data.TaggedError("InvalidTelemetryEnvironment")<{
	readonly value: string;
}> {}

export class InvalidTelemetryEndpoint extends Data.TaggedError("InvalidTelemetryEndpoint")<{
	readonly value: string;
}> {}

export class InvalidConfigPath extends Data.TaggedError("InvalidConfigPath")<{
	readonly value: string;
}> {}

export class ConfigFileParseError extends Data.TaggedError("ConfigFileParseError")<{
	readonly path: string;
	readonly message: string;
	readonly cause: unknown;
}> {}

export class ConfigFileWriteError extends Data.TaggedError("ConfigFileWriteError")<{
	readonly path: string;
	readonly message: string;
	readonly cause: unknown;
}> {}

export class ExplicitConfigFileNotFound extends Data.TaggedError("ExplicitConfigFileNotFound")<{
	readonly path: string;
}> {}

export class ConfigFileAlreadyExists extends Data.TaggedError("ConfigFileAlreadyExists")<{
	readonly path: string;
}> {}

export type ConfigError =
	| Config.ConfigError
	| ConfigFileParseError
	| ConfigFileWriteError
	| ExplicitConfigFileNotFound
	| InvalidConfigPath
	| InvalidTelemetryEndpoint
	| InvalidTelemetryEnvironment;

export type ConfigPathResolution = {
	readonly path: string;
	readonly source: "default" | "env";
};

export type ConfigSourceStatus =
	| {
			readonly _tag: "valid";
			readonly message: string;
	  }
	| {
			readonly _tag: "warning";
			readonly message: string;
	  }
	| {
			readonly _tag: "invalid";
			readonly message: string;
	  };

export type ConfigValidationReport = {
	readonly path: ConfigPathResolution;
	readonly file: ConfigSourceStatus;
	readonly env: ConfigSourceStatus;
	readonly effective: ConfigSourceStatus;
	readonly config: ArtiflowConfiguration | undefined;
};

type ConfigSourceProvider = {
	readonly provider: ConfigProvider.ConfigProvider;
};

type ConfigFileSource = ConfigSourceProvider & {
	readonly _tag: "present" | "missingDefault";
};

type ResolvedConfigSources = {
	readonly path: ConfigPathResolution;
	readonly file: Result.Result<ConfigFileSource, ConfigFileParseError | ExplicitConfigFileNotFound>;
	readonly env: Result.Result<ConfigSourceProvider, InvalidTelemetryEndpoint | InvalidTelemetryEnvironment>;
};

const normalizeUrl = (url: URL): string => url.toString().replace(/\/$/, "");

export const telemetryConfigDescriptor = Config.all({
	enabled: Config.boolean("enabled").pipe(Config.withDefault(defaultArtiflowConfiguration.telemetry.enabled)),
	otlpEndpoint: Config.url("otlp_endpoint").pipe(
		Config.withDefault(new URL(defaultArtiflowConfiguration.telemetry.otlpEndpoint)),
		Config.map(normalizeUrl),
	),
}).pipe(
	Config.map(({ enabled, otlpEndpoint }) => ({
		enabled,
		otlpEndpoint,
	})),
	Config.nested("telemetry"),
);

export const artiflowConfigDescriptor = Config.all({
	telemetry: telemetryConfigDescriptor,
});

export const starterConfigToml = `# Artiflow Configuration
#
# Telemetry is disabled by default. Set enabled to true to export traces and logs
# to a local OTLP HTTP collector.

[telemetry]
enabled = false
otlp_endpoint = "${DEFAULT_OTLP_HTTP_ENDPOINT}"
`;

const normalizeUrlString = (value: string) =>
	Effect.try({
		try: () => normalizeUrl(new URL(value)),
		catch: () => new InvalidTelemetryEndpoint({ value }),
	});

export const parseTelemetryEnabledEnv = (
	value: string | undefined,
): Effect.Effect<boolean | undefined, InvalidTelemetryEnvironment> => {
	if (value === undefined) {
		return Effect.succeed(undefined);
	}
	if (value === "true") {
		return Effect.succeed(true);
	}
	if (value === "false") {
		return Effect.succeed(false);
	}
	return Effect.fail(new InvalidTelemetryEnvironment({ value }));
};

export const parseTelemetryEndpointEnv = (
	value: string | undefined,
): Effect.Effect<string | undefined, InvalidTelemetryEndpoint> => {
	if (value === undefined) {
		return Effect.succeed(undefined);
	}
	return normalizeUrlString(value);
};

export const resolveConfigPath = (
	env: Record<string, string | undefined> = process.env,
): Effect.Effect<ConfigPathResolution, InvalidConfigPath> =>
	Effect.suspend(() => {
		const configuredPath = env[CONFIG_PATH_ENV];
		if (configuredPath !== undefined && configuredPath.trim() === "") {
			return Effect.fail(new InvalidConfigPath({ value: configuredPath }));
		}

		const path = configuredPath ?? DEFAULT_CONFIG_PATH;
		const source: ConfigPathResolution["source"] = configuredPath === undefined ? "default" : "env";
		return Effect.succeed({
			path: expandHome(path),
			source,
		});
	}).pipe(
		Effect.tap((path) =>
			Effect.annotateCurrentSpan({
				"artiflow.config.path": path.path,
				"artiflow.config.path_source": path.source,
			}),
		),
		Effect.tap((path) =>
			Effect.logDebug("Resolved config path", {
				path: path.path,
				source: path.source,
				pathEnvPresent: env[CONFIG_PATH_ENV] !== undefined,
			}),
		),
	);

export const loadArtiflowConfigFromEnvironment = (env: Record<string, string | undefined>) =>
	Effect.gen(function* () {
		const sources = yield* resolveConfigSources(env);
		return yield* parseEffectiveConfig(sources);
	});

export const loadArtiflowConfig = Effect.gen(function* () {
	const sources = yield* resolveConfigSources(process.env);
	return yield* parseEffectiveConfig(sources);
});

export const validateArtiflowConfigFromEnvironment = (env: Record<string, string | undefined>) =>
	Effect.gen(function* () {
		const sources = yield* resolveConfigSources(env);

		return yield* validateResolvedConfigSources(sources);
	}).pipe(Effect.withSpan("artiflow.config.validate.from_env"));

export const validateArtiflowConfig = Effect.gen(function* () {
	const sources = yield* resolveConfigSources(process.env);

	return yield* validateResolvedConfigSources(sources);
}).pipe(Effect.withSpan("artiflow.config.validate"));

const validateResolvedConfigSources = (sources: ResolvedConfigSources) =>
	Effect.gen(function* () {
		const fileStatus = yield* Result.match(sources.file, {
			onFailure: (error) => Effect.succeed(invalidStatus(formatConfigError(error))),
			onSuccess: (source) =>
				source._tag === "missingDefault"
					? Effect.succeed(warningStatus(`No config file found at ${sources.path.path}; using defaults.`))
					: artiflowConfigDescriptor.parse(source.provider).pipe(
							Effect.as<ConfigSourceStatus>(validStatus(`Config file is valid at ${sources.path.path}.`)),
							Effect.catch((error) => Effect.succeed(invalidStatus(formatConfigError(error)))),
						),
		});

		const envStatus = Result.match(sources.env, {
			onFailure: (error) => invalidStatus(formatConfigError(error)),
			onSuccess: () => validStatus("Environment overrides are valid."),
		});

		const effectiveResult = yield* Effect.result(parseEffectiveConfig(sources));

		const report = {
			path: sources.path,
			file: fileStatus,
			env: envStatus,
			effective: Result.isSuccess(effectiveResult)
				? validStatus("Valid Artiflow Configuration.")
				: invalidStatus(formatConfigError(effectiveResult.failure)),
			config: Result.isSuccess(effectiveResult) ? effectiveResult.success : undefined,
		};

		yield* Effect.annotateCurrentSpan({
			"artiflow.config.valid":
				report.file._tag !== "invalid" && report.env._tag !== "invalid" && report.effective._tag !== "invalid",
			"artiflow.config.file_validation_status": report.file._tag,
			"artiflow.config.env_validation_status": report.env._tag,
			"artiflow.config.effective_validation_status": report.effective._tag,
		});

		return report;
	});

export const initArtiflowConfigFromEnvironment = (env: Record<string, string | undefined>) =>
	Effect.gen(function* () {
		const path = yield* resolveConfigPath(env);
		return yield* initArtiflowConfigAtPath(path);
	});

export const initArtiflowConfig = Effect.gen(function* () {
	const path = yield* resolveConfigPath(process.env);

	return yield* initArtiflowConfigAtPath(path);
});

const initArtiflowConfigAtPath = (path: ConfigPathResolution) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs
			.exists(path.path)
			.pipe(Effect.mapError((cause) => makeConfigFileWriteError(path.path, cause)));

		yield* Effect.annotateCurrentSpan({
			"artiflow.config.exists": exists,
		});

		if (exists) {
			return yield* Effect.fail(new ConfigFileAlreadyExists({ path: path.path }));
		}

		yield* fs
			.makeDirectory(dirname(path.path), { recursive: true })
			.pipe(Effect.mapError((cause) => makeConfigFileWriteError(path.path, cause)));
		yield* fs
			.writeFileString(path.path, starterConfigToml)
			.pipe(Effect.mapError((cause) => makeConfigFileWriteError(path.path, cause)));

		yield* Effect.logInfo("Created Artiflow Configuration file", {
			path: path.path,
			source: path.source,
		});

		yield* Effect.annotateCurrentSpan({
			"artiflow.config.created": true,
		});

		return path;
	}).pipe(
		Effect.withSpan("artiflow.config.write_file", {
			attributes: {
				"artiflow.config.parent_directory": dirname(path.path),
				"file.operation": "write",
			},
		}),
	);

export class ArtiflowConfig extends Context.Service<ArtiflowConfig, ArtiflowConfiguration>()("ArtiflowConfig") {
	static readonly layer = Layer.effect(ArtiflowConfig)(loadArtiflowConfig);
	static readonly layerFromEnvironment = (env: Record<string, string | undefined>) =>
		Layer.effect(ArtiflowConfig)(loadArtiflowConfigFromEnvironment(env));
}

export const formatConfigError = (error: ConfigError | ConfigFileAlreadyExists): string => {
	switch (error._tag) {
		case "ConfigFileAlreadyExists":
			return `Config file already exists at ${error.path}.`;
		case "ConfigFileParseError":
			return `Could not parse config file at ${error.path}: ${error.message}`;
		case "ConfigFileWriteError":
			return `Could not write config file at ${error.path}: ${error.message}`;
		case "ExplicitConfigFileNotFound":
			return `Config file from ${CONFIG_PATH_ENV} does not exist at ${error.path}.`;
		case "InvalidConfigPath":
			return `Invalid ${CONFIG_PATH_ENV} value "${error.value}". Expected a non-empty path.`;
		case "InvalidTelemetryEndpoint":
			return `Invalid ${OTLP_ENDPOINT_ENV} value "${error.value}". Expected an absolute URL.`;
		case "InvalidTelemetryEnvironment":
			return `Invalid ${TELEMETRY_ENV} value "${error.value}". Expected "true" or "false".`;
		case "ConfigError":
			return error.message;
	}
};

const makeConfigFileWriteError = (path: string, cause: unknown) =>
	new ConfigFileWriteError({
		path,
		message: cause instanceof Error ? cause.message : String(cause),
		cause,
	});

const loadFileProvider = (
	path: ConfigPathResolution,
): Effect.Effect<ConfigFileSource, ConfigFileParseError | ExplicitConfigFileNotFound, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const exists = yield* fs.exists(path.path).pipe(
			Effect.mapError(
				(cause) =>
					new ConfigFileParseError({
						path: path.path,
						message: cause.message,
						cause,
					}),
			),
		);

		yield* Effect.annotateCurrentSpan({
			"artiflow.config.file_present": exists,
		});

		if (!exists) {
			if (path.source === "env") {
				return yield* Effect.fail(new ExplicitConfigFileNotFound({ path: path.path }));
			}
			yield* Effect.annotateCurrentSpan({
				"artiflow.config.file_presence": "missing_default",
			});
			return {
				_tag: "missingDefault",
				provider: ConfigProvider.fromUnknown({}),
			} satisfies ConfigFileSource;
		}

		const contents = yield* fs.readFileString(path.path).pipe(
			Effect.mapError(
				(cause) =>
					new ConfigFileParseError({
						path: path.path,
						message: cause.message,
						cause,
					}),
			),
		);
		const parsed = yield* Effect.try({
			try: () => Toml.parse(contents) as unknown,
			catch: (cause) =>
				new ConfigFileParseError({
					path: path.path,
					message: cause instanceof Error ? cause.message : String(cause),
					cause,
				}),
		});

		yield* Effect.annotateCurrentSpan({
			"artiflow.config.file_presence": "present",
		});

		return {
			_tag: "present",
			provider: ConfigProvider.fromUnknown(parsed),
		} satisfies ConfigFileSource;
	}).pipe(
		Effect.withSpan("artiflow.config.load_file", {
			attributes: {
				"artiflow.config.path": path.path,
				"artiflow.config.path_source": path.source,
			},
		}),
	);

const loadEnvOverrideProvider = (
	env: Record<string, string | undefined> = process.env,
): Effect.Effect<ConfigSourceProvider, InvalidTelemetryEndpoint | InvalidTelemetryEnvironment> =>
	Effect.gen(function* () {
		const enabled = yield* parseTelemetryEnabledEnv(env[TELEMETRY_ENV]);
		const otlpEndpoint = yield* parseTelemetryEndpointEnv(env[OTLP_ENDPOINT_ENV]);

		yield* Effect.annotateCurrentSpan({
			"artiflow.telemetry.env_present": env[TELEMETRY_ENV] !== undefined,
			"artiflow.telemetry.endpoint_env_present": env[OTLP_ENDPOINT_ENV] !== undefined,
		});

		return {
			provider: ConfigProvider.fromUnknown({
				telemetry: {
					...(enabled === undefined ? {} : { enabled }),
					...(otlpEndpoint === undefined ? {} : { otlp_endpoint: otlpEndpoint }),
				},
			}),
		};
	}).pipe(Effect.withSpan("artiflow.config.load_env"));

const resolveConfigSources = (
	env: Record<string, string | undefined> = process.env,
): Effect.Effect<ResolvedConfigSources, InvalidConfigPath, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const path = yield* resolveConfigPath(env);
		const file = yield* Effect.result(loadFileProvider(path));
		const envOverrides = yield* Effect.result(loadEnvOverrideProvider(env));

		return {
			path,
			file,
			env: envOverrides,
		};
	});

const parseEffectiveConfig = (sources: ResolvedConfigSources): Effect.Effect<ArtiflowConfiguration, ConfigError> =>
	Effect.gen(function* () {
		const file = yield* Result.match(sources.file, {
			onFailure: Effect.fail,
			onSuccess: Effect.succeed,
		});
		const env = yield* Result.match(sources.env, {
			onFailure: Effect.fail,
			onSuccess: Effect.succeed,
		});
		const provider = ConfigProvider.orElse(
			env.provider,
			ConfigProvider.orElse(file.provider, ConfigProvider.fromUnknown(defaultArtiflowConfiguration)),
		);

		const config = yield* artiflowConfigDescriptor.parse(provider);

		yield* Effect.annotateCurrentSpan({
			"artiflow.config.effective_status": "valid",
			"artiflow.telemetry.enabled": config.telemetry.enabled,
		});

		return config;
	}).pipe(Effect.withSpan("artiflow.config.parse_effective"));

const validStatus = (message: string): ConfigSourceStatus => ({
	_tag: "valid",
	message,
});

const invalidStatus = (message: string): ConfigSourceStatus => ({
	_tag: "invalid",
	message,
});

const warningStatus = (message: string): ConfigSourceStatus => ({
	_tag: "warning",
	message,
});

const expandHome = (path: string): string => {
	if (path === "~") {
		return homedir();
	}
	if (path.startsWith("~/")) {
		return resolve(homedir(), path.slice(2));
	}
	return resolve(path);
};
