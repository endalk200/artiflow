import {
	ARTIFLOW_SERVICE_NAMESPACE,
	isOtelSdkDisabled,
	resolveOtlpHttpEndpoints,
	type TelemetryEnvironment,
} from "@app/telemetry-config";
import { layerFetch } from "@effect/platform-node/NodeHttpClient";
import { Console, Data, Duration, Effect, Layer, Logger } from "effect";
import * as OtlpLogger from "effect/unstable/observability/OtlpLogger";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";

import { VERSION } from "../version.js";

const shutdownTimeout = Duration.millis(500);

export const withoutConsoleLogger = Logger.layer([], {
	mergeWithExisting: false,
});

export class TelemetryConfigurationError extends Data.TaggedError("TelemetryConfigurationError")<{
	readonly cause: unknown;
	readonly message: string;
}> {}

const makeTelemetryLayer = (environment: TelemetryEnvironment) =>
	Layer.unwrap(
		Effect.try({
			try: () => {
				if (isOtelSdkDisabled(environment)) return withoutConsoleLogger;

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

const invalidConfigurationFallback = (error: TelemetryConfigurationError) =>
	Layer.effectDiscard(Console.error(`Warning: ${error.message} Telemetry disabled.`)).pipe(
		Layer.merge(withoutConsoleLogger),
	);

/**
 * The CLI runtime owns this layer, so NodeRuntime waits for its scoped
 * OpenTelemetry providers to flush and shut down before the process exits.
 */
export const telemetryLayerFromEnvironment = (environment: TelemetryEnvironment) =>
	makeTelemetryLayer(environment).pipe(Layer.catchTag("TelemetryConfigurationError", invalidConfigurationFallback));

export const telemetryLayer = telemetryLayerFromEnvironment(process.env);
