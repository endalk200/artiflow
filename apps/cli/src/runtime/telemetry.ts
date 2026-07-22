import {
	ARTIFLOW_SERVICE_NAMESPACE,
	OTEL_SDK_DISABLED_ENV,
	resolveOtlpHttpEndpoints,
	type TelemetryEnvironment,
} from "@app/telemetry-config";
import { layerFetch } from "@effect/platform-node/NodeHttpClient";
import { Console, Data, Duration, Effect, Layer, Logger } from "effect";
import * as OtlpLogger from "effect/unstable/observability/OtlpLogger";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";

import { ArtiflowConfig } from "../config/index.js";
import { VERSION } from "../version.js";

const shutdownTimeout = Duration.millis(500);

export const withoutConsoleLogger = Logger.layer([], {
	mergeWithExisting: false,
});

export class TelemetryConfigurationError extends Data.TaggedError("TelemetryConfigurationError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

type CliTelemetryPreference = {
	readonly enabled: boolean;
	readonly warning?: string;
};

export const resolveCliTelemetryPreference = (
	environment: TelemetryEnvironment,
	configuredEnabled: boolean,
): CliTelemetryPreference => {
	const configured = environment[OTEL_SDK_DISABLED_ENV]?.trim();
	if (configured === undefined || configured === "") return { enabled: configuredEnabled };
	if (configured.toLowerCase() === "true") return { enabled: false };
	if (configured.toLowerCase() === "false") return { enabled: true };
	return {
		enabled: true,
		warning: `Warning: Invalid ${OTEL_SDK_DISABLED_ENV} value. Expected "true" or "false"; treating it as "false".`,
	};
};

const makeTelemetryLayer = (environment: TelemetryEnvironment, configuredEnabled: boolean) => {
	const preference = resolveCliTelemetryPreference(environment, configuredEnabled);
	if (!preference.enabled) return withoutConsoleLogger;

	const exporters = Layer.unwrap(
		Effect.try({
			try: () => {
				const endpoints = resolveOtlpHttpEndpoints(environment);
				const resource = {
					attributes: {
						"service.namespace": ARTIFLOW_SERVICE_NAMESPACE,
					},
					serviceName: environment.OTEL_SERVICE_NAME ?? "artiflow-cli",
					serviceVersion: VERSION,
				};
				return Layer.mergeAll(
					OtlpLogger.layer({
						mergeWithExisting: false,
						resource,
						shutdownTimeout,
						url: endpoints.logs,
					}),
					OtlpTracer.layer({
						resource,
						shutdownTimeout,
						url: endpoints.traces,
					}),
				).pipe(Layer.provide(OtlpSerialization.layerProtobuf), Layer.provide(layerFetch));
			},
			catch: (cause) =>
				new TelemetryConfigurationError({
					cause,
					message: cause instanceof Error ? cause.message : "Invalid OpenTelemetry configuration.",
				}),
		}),
	);

	return preference.warning === undefined
		? exporters
		: Layer.unwrap(
				Effect.gen(function* () {
					yield* Console.error(preference.warning);
					return exporters;
				}),
			);
};

const invalidConfigurationFallback = (error: TelemetryConfigurationError) =>
	Layer.effectDiscard(Console.error(`Warning: ${error.message} Telemetry disabled.`)).pipe(
		Layer.merge(withoutConsoleLogger),
	);

/**
 * The CLI runtime owns this layer, so NodeRuntime waits for its scoped
 * OpenTelemetry providers to flush and shut down before the process exits.
 */
export const telemetryLayerFromEnvironment = (environment: TelemetryEnvironment, configuredEnabled = true) =>
	makeTelemetryLayer(environment, configuredEnabled).pipe(
		Layer.catchTag("TelemetryConfigurationError", invalidConfigurationFallback),
	);

export const telemetryLayer = Layer.unwrap(
	ArtiflowConfig.pipe(
		Effect.map(({ telemetryEnabled }) => telemetryLayerFromEnvironment(process.env, telemetryEnabled)),
	),
);
