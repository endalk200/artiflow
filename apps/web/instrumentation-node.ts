import {
	isOtelSdkDisabled,
	resolveOtlpHttpEndpoints,
} from "@app/telemetry-config";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

import {
	ARTIFLOW_SERVICE_NAMESPACE,
	DEFAULT_WEB_TELEMETRY_SERVICE_NAME,
	WEB_TELEMETRY_SERVICE_VERSION,
} from "./telemetry-resource";

const nextLogger = logs.getLogger("artiflow.nextjs");

export const registerNodeInstrumentation = () => {
	if (isOtelSdkDisabled()) return;

	const endpoints = resolveOtlpHttpEndpoints();

	registerOTel({
		attributes: {
			"service.namespace": ARTIFLOW_SERVICE_NAMESPACE,
			"service.version": WEB_TELEMETRY_SERVICE_VERSION,
		},
		logRecordProcessors: [
			new BatchLogRecordProcessor({
				exporter: new OTLPLogExporter({ url: endpoints.logs }),
			}),
		],
		serviceName:
			process.env.OTEL_SERVICE_NAME ?? DEFAULT_WEB_TELEMETRY_SERVICE_NAME,
		spanProcessors: [
			new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoints.traces })),
		],
	});
};

export const reportNextRequestError: Instrumentation.onRequestError = (
	error,
	request,
	context,
) => {
	const errorType =
		error instanceof Error ? error.constructor.name : typeof error;
	const digest =
		typeof error === "object" &&
		error !== null &&
		"digest" in error &&
		typeof error.digest === "string"
			? error.digest
			: undefined;
	const reportedException = new Error("Unhandled Next.js request error");
	reportedException.name = errorType;
	if (error instanceof Error && error.stack !== undefined) {
		const stackFrames = error.stack.split("\n").slice(1);
		reportedException.stack = [
			`${errorType}: Unhandled Next.js request error`,
			...stackFrames,
		].join("\n");
	}

	nextLogger.emit({
		attributes: {
			"error.type": errorType,
			"http.request.method": request.method,
			"next.route": context.routePath,
			"next.route_type": context.routeType,
			"next.router_kind": context.routerKind,
			...(digest === undefined ? {} : { "next.error.digest": digest }),
		},
		body: "Unhandled Next.js request error",
		exception: reportedException,
		severityNumber: SeverityNumber.ERROR,
		severityText: "ERROR",
	});
};
