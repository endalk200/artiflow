import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Effect } from "effect";
import { TestConsole } from "effect/testing";
import { afterEach, describe, expect, it } from "vitest";

import { traceCliRun } from "../cli/run.js";
import { telemetryLayerFromEnvironment } from "./telemetry.js";

type ExportRequest = {
	readonly body: Buffer;
	readonly path: string;
};

const openServers = new Set<ReturnType<typeof createServer>>();

afterEach(() => {
	for (const server of openServers) {
		if (!server.listening) continue;
		server.close();
		server.closeAllConnections();
	}
	openServers.clear();
});

describe("CLI telemetry", () => {
	it("warns and keeps running when the endpoint is invalid", async () => {
		const errors = await Effect.runPromise(
			Effect.gen(function* () {
				yield* Effect.logInfo("This logger is disabled by the fallback");
				return yield* TestConsole.errorLines;
			}).pipe(
				Effect.provide(
					telemetryLayerFromEnvironment({
						OTEL_EXPORTER_OTLP_ENDPOINT: "ftp://collector.example.com",
					}),
				),
				Effect.provide(TestConsole.layer),
			),
		);

		expect(errors).toEqual([
			"Warning: Invalid OTEL_EXPORTER_OTLP_ENDPOINT. Expected an absolute HTTP or HTTPS URL. Telemetry disabled.",
		]);
	});

	it("exports final batched spans and logs before the runtime scope closes", async () => {
		const requests: Array<ExportRequest> = [];
		const collector = createServer((request, response) => {
			const chunks: Array<Buffer> = [];
			request.on("data", (chunk: Buffer) => chunks.push(chunk));
			request.on("end", () => {
				requests.push({
					body: Buffer.concat(chunks),
					path: request.url ?? "",
				});
				response.statusCode = 200;
				response.setHeader("content-type", "application/x-protobuf");
				response.end();
			});
		});
		openServers.add(collector);

		await new Promise<void>((resolve, reject) => {
			collector.once("error", reject);
			collector.listen(0, "127.0.0.1", resolve);
		});
		const { port } = collector.address() as AddressInfo;
		await Effect.runPromise(
			Effect.all([
				traceCliRun(["version"], Effect.void),
				Effect.exit(
					traceCliRun(["unknown", "/private/source/report.mdx"], Effect.fail({ _tag: "InvalidRequest" as const })),
				),
			]).pipe(
				Effect.provide(
					telemetryLayerFromEnvironment({
						OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}`,
					}),
				),
			),
		);

		const traces = requests.filter(({ path }) => path === "/v1/traces");
		const logs = requests.filter(({ path }) => path === "/v1/logs");
		expect(traces).toHaveLength(1);
		expect(logs).toHaveLength(1);

		const tracePayload = traces[0]?.body.toString("utf8") ?? "";
		const logPayload = logs[0]?.body.toString("utf8") ?? "";
		expect(tracePayload).toContain("artiflow-cli");
		expect(tracePayload).toContain("artiflow.cli");
		expect(logPayload).toContain("artiflow-cli");
		expect(logPayload).toContain("Artiflow CLI command completed");
		expect(logPayload).toContain("Artiflow CLI command failed");
		expect(logPayload).toContain("InvalidRequest");
		expect(`${tracePayload}${logPayload}`).not.toContain("/private/source/report.mdx");
	}, 10_000);

	it("bounds shutdown when the collector accepts but never responds", async () => {
		const collector = createServer(() => {
			// Deliberately leave the response open until the telemetry scope interrupts it.
		});
		openServers.add(collector);
		await new Promise<void>((resolve, reject) => {
			collector.once("error", reject);
			collector.listen(0, "127.0.0.1", resolve);
		});
		const { port } = collector.address() as AddressInfo;
		const startedAt = performance.now();

		const result = await Effect.runPromise(
			Effect.logInfo("Pending telemetry").pipe(
				Effect.andThen(Effect.succeed("command-result")),
				Effect.withSpan("artiflow.cli.test"),
				Effect.provide(
					telemetryLayerFromEnvironment({
						OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}`,
					}),
				),
			),
		);

		expect(result).toBe("command-result");
		expect(performance.now() - startedAt).toBeLessThan(1_500);
	}, 5_000);
});
