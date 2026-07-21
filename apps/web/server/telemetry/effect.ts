import * as OtelLogger from "@effect/opentelemetry/OtelLogger";
import * as OtelResource from "@effect/opentelemetry/Resource";
import * as OtelTracer from "@effect/opentelemetry/OtelTracer";
import { context, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import type { LoggerProvider } from "@opentelemetry/sdk-logs";
import { Context, type Effect, Layer } from "effect";
import * as EffectTracer from "effect/Tracer";

import {
	DEFAULT_WEB_TELEMETRY_SERVICE_NAME,
	WEB_TELEMETRY_SERVICE_VERSION,
} from "../../telemetry-resource";

const ResourceLive = OtelResource.layer({
	serviceName:
		process.env.OTEL_SERVICE_NAME ?? DEFAULT_WEB_TELEMETRY_SERVICE_NAME,
	serviceVersion: WEB_TELEMETRY_SERVICE_VERSION,
});

const GlobalLoggerProviderLive = Layer.sync(
	OtelLogger.OtelLoggerProvider,
	() => logs.getLoggerProvider() as LoggerProvider,
);

const TracingLive = OtelTracer.layerGlobal.pipe(Layer.provide(ResourceLive));
const LoggingLive = OtelLogger.layer({ mergeWithExisting: true }).pipe(
	Layer.provide(GlobalLoggerProviderLive),
);

/** Bridges Effect spans and structured logs into the providers registered by Next.js. */
export const effectTelemetryLayer = Layer.merge(TracingLive, LoggingLive);

/** Continues the active Next.js trace when crossing from JavaScript into Effect. */
export const continueActiveTrace = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
) => {
	const activeSpan = trace.getSpan(context.active());
	return activeSpan === undefined
		? effect
		: OtelTracer.withSpanContext(effect, activeSpan.spanContext());
};

/** Captures the active OpenTelemetry span for a newly-created Effect runtime. */
export const activeTraceContext = () => {
	const activeSpan = trace.getSpan(context.active());
	if (activeSpan === undefined) return undefined;

	const spanContext = activeSpan.spanContext();
	return Context.make(
		EffectTracer.ParentSpan,
		OtelTracer.makeExternalSpan({
			spanId: spanContext.spanId,
			traceFlags: spanContext.traceFlags,
			traceId: spanContext.traceId,
			traceState: spanContext.traceState,
		}),
	);
};
