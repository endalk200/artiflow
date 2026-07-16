import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import { DEFAULT_OTLP_HTTP_ENDPOINT, ArtiflowConfig, type ArtiflowConfiguration } from "../config/index.js";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Console, Data, Effect, Layer, Logger } from "effect";

import { VERSION } from "../version.js";

export { DEFAULT_OTLP_HTTP_ENDPOINT } from "../config/index.js";

export class TelemetryCollectorUnavailable extends Data.TaggedError("TelemetryCollectorUnavailable")<{
	readonly endpoint: string;
	readonly cause: unknown;
}> {}

export type TelemetryMode = "enabled" | "disabled";

export const withoutConsoleLogger = Logger.layer([], {
	mergeWithExisting: false,
});

const otlpTraceEndpoint = (endpoint: string) => `${endpoint.replace(/\/$/, "")}/v1/traces`;

const checkCollector = (endpoint: string) =>
	Effect.tryPromise({
		try: async () => {
			const response = await fetch(otlpTraceEndpoint(endpoint), {
				method: "OPTIONS",
				signal: AbortSignal.timeout(1_000),
			});

			if (!response.ok && response.status !== 404 && response.status !== 405) {
				throw new Error(`Collector responded with HTTP ${response.status}`);
			}

			return undefined;
		},
		catch: (cause) => new TelemetryCollectorUnavailable({ endpoint, cause }),
	}).pipe(Effect.asVoid);

const makeTelemetryLayer = (endpoint: string) =>
	NodeSdk.layer(
		Effect.gen(function* () {
			yield* checkCollector(endpoint);

			return {
				resource: {
					serviceName: "artiflow-cli",
					serviceVersion: VERSION,
				},
				spanProcessor: [
					new SimpleSpanProcessor(
						new OTLPTraceExporter({
							url: otlpTraceEndpoint(endpoint),
						}),
					),
				],
				logRecordProcessor: [
					new SimpleLogRecordProcessor(
						new OTLPLogExporter({
							url: `${endpoint.replace(/\/$/, "")}/v1/logs`,
						}),
					),
				],
				loggerMergeWithExisting: false,
			};
		}),
	);

const unavailableTelemetryFallback = (error: TelemetryCollectorUnavailable) =>
	Layer.effectDiscard(
		Console.error(`Warning: OTLP collector unreachable at ${error.endpoint}; telemetry disabled.`),
	).pipe(Layer.merge(withoutConsoleLogger));

export const telemetryLayerFromMode = (
	mode: TelemetryMode,
	endpoint = DEFAULT_OTLP_HTTP_ENDPOINT,
): Layer.Layer<never> =>
	mode === "enabled"
		? makeTelemetryLayer(endpoint).pipe(Layer.catchTag("TelemetryCollectorUnavailable", unavailableTelemetryFallback))
		: withoutConsoleLogger;

export const telemetryLayerFromConfiguration = (config: ArtiflowConfiguration): Layer.Layer<never> =>
	telemetryLayerFromMode(config.telemetry.enabled ? "enabled" : "disabled", config.telemetry.otlpEndpoint);

export const telemetryLayer = Layer.unwrap(
	Effect.gen(function* () {
		const config = yield* ArtiflowConfig;
		return telemetryLayerFromConfiguration(config);
	}),
);
