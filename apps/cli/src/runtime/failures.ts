import { formatConfigError } from "../config/index.js";
import { Console, Data, Effect } from "effect";

export class ConfigValidationFailed extends Data.TaggedError("ConfigValidationFailed") {}

const printAndFail = <E>(error: E, message: string) => Console.error(message).pipe(Effect.andThen(Effect.fail(error)));

export const handleCliFailure = {
	ConfigFileAlreadyExists: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error)),
	ConfigFileParseError: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error)),
	ConfigFileWriteError: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error)),
	ConfigValidationFailed: (error: ConfigValidationFailed) => Effect.fail(error),
	ExplicitConfigFileNotFound: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error)),
	InvalidConfigPath: (error: Parameters<typeof formatConfigError>[0]) => printAndFail(error, formatConfigError(error)),
	InvalidTelemetryEndpoint: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error)),
	InvalidTelemetryEnvironment: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error)),
} as const;
