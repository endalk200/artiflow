import { context, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import {
	InMemoryLogRecordExporter,
	LoggerProvider,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
	activeTraceContext,
	continueActiveTrace,
	effectTelemetryLayer,
} from "./effect";

afterEach(() => {
	trace.disable();
	context.disable();
	logs.disable();
});

describe("Effect OpenTelemetry bridge", () => {
	it("parents Effect spans to Next.js spans and correlates structured logs", async () => {
		const spanExporter = new InMemorySpanExporter();
		const tracerProvider = new NodeTracerProvider({
			spanProcessors: [new SimpleSpanProcessor(spanExporter)],
		});
		tracerProvider.register();

		const logExporter = new InMemoryLogRecordExporter();
		const loggerProvider = new LoggerProvider({
			processors: [new SimpleLogRecordProcessor(logExporter)],
		});
		logs.setGlobalLoggerProvider(loggerProvider);

		const nextSpan = trace
			.getTracer("artiflow.telemetry.test")
			.startSpan("next.request");

		await context.with(trace.setSpan(context.active(), nextSpan), () => {
			const handlerContext = activeTraceContext();
			if (handlerContext === undefined) {
				throw new Error("Expected the active Next.js span to be captured.");
			}

			return Effect.runPromise(
				Effect.all([
					continueActiveTrace(
						Effect.logInfo("Project created").pipe(
							Effect.annotateLogs({
								"artiflow.operation.outcome": "created",
							}),
							Effect.withSpan("artiflow.project.create"),
						),
					),
					Effect.void.pipe(
						Effect.withSpan("artiflow.http.handler"),
						Effect.provide(handlerContext),
					),
				]).pipe(Effect.provide(effectTelemetryLayer)),
			);
		});
		nextSpan.end();

		await Promise.all([
			tracerProvider.forceFlush(),
			loggerProvider.forceFlush(),
		]);

		const spans = spanExporter.getFinishedSpans();
		const nextRequest = spans.find(({ name }) => name === "next.request");
		const projectCreate = spans.find(
			({ name }) => name === "artiflow.project.create",
		);
		const httpHandler = spans.find(
			({ name }) => name === "artiflow.http.handler",
		);
		expect(nextRequest).toBeDefined();
		expect(projectCreate?.parentSpanContext?.spanId).toBe(
			nextRequest?.spanContext().spanId,
		);
		expect(projectCreate?.spanContext().traceId).toBe(
			nextRequest?.spanContext().traceId,
		);
		expect(httpHandler?.parentSpanContext?.spanId).toBe(
			nextRequest?.spanContext().spanId,
		);

		const records = logExporter.getFinishedLogRecords();
		const projectCreated = records.find(
			({ body }) => body === "Project created",
		);
		expect(projectCreated?.attributes["artiflow.operation.outcome"]).toBe(
			"created",
		);
		expect(projectCreated?.spanContext?.spanId).toBe(
			projectCreate?.spanContext().spanId,
		);

		await Promise.all([tracerProvider.shutdown(), loggerProvider.shutdown()]);
	});
});
