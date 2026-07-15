import * as NodeSdk from "@effect/opentelemetry/NodeSdk";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
	ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
	ATTR_SERVICE_NAME,
	ATTR_TELEMETRY_SDK_LANGUAGE,
	ATTR_TELEMETRY_SDK_NAME,
	TELEMETRY_SDK_LANGUAGE_VALUE_NODEJS,
} from "@opentelemetry/semantic-conventions";
import { Layer } from "effect";

const serviceName = process.env.OTEL_SERVICE_NAME ?? "nextjs-launchkey-web";
const otlpEndpoint =
	process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";

const exportBatchConfig = {
	exportTimeoutMillis: 5_000,
	maxExportBatchSize: 64,
	maxQueueSize: 512,
	scheduledDelayMillis: 250,
};

function appendOtlpPath(path: "v1/logs" | "v1/traces") {
	return new URL(
		path,
		otlpEndpoint.endsWith("/") ? otlpEndpoint : `${otlpEndpoint}/`,
	).toString();
}

const tracesUrl =
	process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? appendOtlpPath("v1/traces");
const logsUrl =
	process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ?? appendOtlpPath("v1/logs");

const resourceAttributes = {
	[ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV ?? "development",
	[ATTR_SERVICE_NAME]: serviceName,
};

const globalRegistration = Symbol.for("nextjs-launchkey.otel.registered");

type GlobalWithOtelRegistration = typeof globalThis & {
	[globalRegistration]?: boolean;
};

export function registerNextOtel() {
	const globalScope = globalThis as GlobalWithOtelRegistration;

	if (globalScope[globalRegistration] === true) {
		return;
	}

	const provider = new NodeTracerProvider({
		resource: resourceFromAttributes({
			...resourceAttributes,
			[ATTR_TELEMETRY_SDK_LANGUAGE]: TELEMETRY_SDK_LANGUAGE_VALUE_NODEJS,
			[ATTR_TELEMETRY_SDK_NAME]: "opentelemetry",
		}),
		spanProcessors: [
			new BatchSpanProcessor(
				new OTLPTraceExporter({ url: tracesUrl }),
				exportBatchConfig,
			),
		],
	});

	provider.register();
	globalScope[globalRegistration] = true;
}

export const OtelLive = NodeSdk.layer(() => ({
	logRecordProcessor: [
		new BatchLogRecordProcessor(
			new OTLPLogExporter({ url: logsUrl }),
			exportBatchConfig,
		),
	],
	resource: {
		attributes: resourceAttributes,
		serviceName,
	},
	shutdownTimeout: 5_000,
	spanProcessor: [
		new BatchSpanProcessor(
			new OTLPTraceExporter({ url: tracesUrl }),
			exportBatchConfig,
		),
	],
})).pipe(Layer.orDie);
