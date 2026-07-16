import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setRpcTraceRoute } from "./rpc-trace-bridge.node";
import { RpcTraceNameProcessor } from "./rpc-trace-name-processor";
import {
	rpcTraceRouteFromBody,
	rpcTraceSummaryFromRoute,
} from "./rpc-trace-route";

const knownOperations = new Set([
	"Post.Create",
	"Post.Delete",
	"Post.List",
	"Post.Update",
]);

const isKnownOperation = (operation: string) => knownOperations.has(operation);

describe("RPC trace route bridge", () => {
	it("encodes and decodes a known operation", () => {
		const route = rpcTraceRouteFromBody(
			{ _tag: "Request", tag: "Post.List" },
			isKnownOperation,
		);

		expect(rpcTraceSummaryFromRoute(route)).toEqual({
			operations: ["Post.List"],
			requestCount: 1,
		});
	});

	it("sorts batch operations and preserves the request count", () => {
		const route = rpcTraceRouteFromBody(
			[
				{ _tag: "Request", tag: "Post.List" },
				{ _tag: "Request", tag: "Post.Create" },
				{ _tag: "Request", tag: "Post.List" },
			],
			isKnownOperation,
		);

		expect(rpcTraceSummaryFromRoute(route)).toEqual({
			operations: ["Post.Create", "Post.List"],
			requestCount: 3,
		});
	});

	it.each([
		undefined,
		null,
		{},
		[],
		{ _tag: "Request", tag: "Unknown.Operation" },
		{ _tag: "Response", tag: "Post.List" },
		[{ _tag: "Request", tag: "Post.List" }, { malformed: true }],
	])("rejects an invalid or unknown body", (body) => {
		expect(rpcTraceRouteFromBody(body, isKnownOperation)).toBeUndefined();
	});

	it.each([
		undefined,
		null,
		"/api/rpc",
		"/__artiflow_rpc__/not-json",
		`/__artiflow_rpc__/${encodeURIComponent(JSON.stringify({ operations: [], requestCount: 0 }))}`,
	])("rejects a malformed temporary route", (route) => {
		expect(rpcTraceSummaryFromRoute(route)).toBeUndefined();
	});
});

describe("RpcTraceNameProcessor", () => {
	let provider: BasicTracerProvider;
	let exporter: InMemorySpanExporter;

	beforeEach(() => {
		exporter = new InMemorySpanExporter();
		provider = new BasicTracerProvider({
			spanProcessors: [
				new RpcTraceNameProcessor(),
				new SimpleSpanProcessor(exporter),
			],
		});
	});

	afterEach(async () => {
		await provider.shutdown();
	});

	function startNextRequest(body: unknown) {
		const route = rpcTraceRouteFromBody(body, isKnownOperation) ?? "/api/rpc";

		return provider.getTracer("next.js").startSpan("POST /api/rpc", {
			attributes: {
				"http.route": route,
				"next.route": route,
				"next.span_name": `POST ${route}`,
				"next.span_type": "BaseServer.handleRequest",
			},
		});
	}

	async function exportedSpan(spanId: string) {
		await provider.forceFlush();

		return exporter
			.getFinishedSpans()
			.find((span) => span.spanContext().spanId === spanId);
	}

	it.each(["Post.List", "Post.Create", "Post.Update", "Post.Delete"])(
		"exports the request span as %s",
		async (operation) => {
			const root = startNextRequest({ _tag: "Request", tag: operation });

			root.end();

			const exportedRoot = await exportedSpan(root.spanContext().spanId);

			expect(exportedRoot?.name).toBe(operation);
			expect(exportedRoot?.attributes).toMatchObject({
				"artiflow.rpc.request_count": 1,
				"http.route": "/api/rpc",
				"next.route": "/api/rpc",
				"next.span_name": operation,
				"rpc.method": operation,
				"rpc.system.name": "effect",
			});
		},
	);

	it("accepts the route summary through the process bridge", async () => {
		const root = startNextRequest({ malformed: true });
		const route = rpcTraceRouteFromBody(
			{ _tag: "Request", tag: "Post.List" },
			isKnownOperation,
		);

		expect(route).toBeDefined();

		if (route !== undefined) {
			setRpcTraceRoute(root.spanContext(), route);
		}

		root.end();

		expect((await exportedSpan(root.spanContext().spanId))?.name).toBe(
			"Post.List",
		);
	});

	it("leaves the HTTP fallback for an invalid request", async () => {
		const root = startNextRequest({ malformed: true });

		root.end();

		expect((await exportedSpan(root.spanContext().spanId))?.name).toBe(
			"POST /api/rpc",
		);
	});

	it("uses a deterministic title and attributes for a mixed batch", async () => {
		const root = startNextRequest([
			{ _tag: "Request", tag: "Post.List" },
			{ _tag: "Request", tag: "Post.Create" },
		]);

		root.end();

		const exportedRoot = await exportedSpan(root.spanContext().spanId);

		expect(exportedRoot?.name).toBe("RPC batch");
		expect(exportedRoot?.attributes).toMatchObject({
			"artiflow.rpc.methods": ["Post.Create", "Post.List"],
			"artiflow.rpc.request_count": 2,
		});
	});

	it("marks RPC child spans without relying on the root provider", async () => {
		const rpc = provider
			.getTracer("artiflow")
			.startSpan("RpcServer.Post.List", {
				attributes: { "artiflow.rpc.server": true },
			});

		rpc.end();

		expect(await exportedSpan(rpc.spanContext().spanId)).toMatchObject({
			attributes: {
				"artiflow.rpc.server": true,
				"rpc.method": "Post.List",
				"rpc.system.name": "effect",
			},
		});
	});
});
