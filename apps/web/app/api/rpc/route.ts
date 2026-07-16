import { AuthMiddlewareLive } from "@app/auth/server";
import { DatabaseLive } from "@app/database";
import {
	PostHandlers,
	PostOperationsLive,
	PostRepositoryPrisma,
	PostRpcs,
} from "@app/post/server";
import {
	context,
	isSpanContextValid,
	type SpanContext,
	trace,
} from "@opentelemetry/api";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { OtelLive } from "../../../observability/otel.node.ts";
import { setRpcTraceRoute } from "../../../observability/rpc-trace-bridge.node.ts";
import { rpcTraceRouteFromBody } from "../../../observability/rpc-trace-route.ts";

export const runtime = "nodejs";

const AppRpcs = PostRpcs;

const AppHandlers = PostHandlers;

const AppOperations = PostOperationsLive;

const AppRepositories = PostRepositoryPrisma;

const ServerLayer = RpcServer.layerHttp({
	group: AppRpcs,
	path: "/api/rpc",
	protocol: "http",
	spanAttributes: {
		"artiflow.rpc.server": true,
	},
	spanPrefix: "RpcServer",
}).pipe(
	Layer.provide(AppHandlers),
	Layer.provide(AppOperations),
	Layer.provide(AppRepositories),
	Layer.provide(AuthMiddlewareLive),
	Layer.provide(DatabaseLive),
	Layer.provide(RpcSerialization.layerJson),
	Layer.provideMerge(OtelLive),
);

const webHandler = HttpRouter.toWebHandler(ServerLayer);
const handler = webHandler.handler as (request: Request) => Promise<Response>;

const tracePropagationHeaders = [
	"b3",
	"traceparent",
	"tracestate",
	"x-b3-flags",
	"x-b3-parentspanid",
	"x-b3-sampled",
	"x-b3-spanid",
	"x-b3-traceid",
];

function requestWithActiveServerTrace(request: Request) {
	const activeSpanContext = trace.getSpan(context.active())?.spanContext();

	if (
		activeSpanContext === undefined ||
		!isSpanContextValid(activeSpanContext)
	) {
		return request;
	}

	const headers = new Headers(request.headers);

	for (const header of tracePropagationHeaders) {
		headers.delete(header);
	}

	// Effect's HTTP tracer reads incoming propagation headers to choose the
	// parent span. In a Next route handler, the parent span already lives in the
	// active OpenTelemetry context, so rewrite the request propagation headers to
	// point at that server span before passing the request into Effect.
	headers.set(
		"traceparent",
		`00-${activeSpanContext.traceId}-${activeSpanContext.spanId}-${activeSpanContext.traceFlags.toString(16).padStart(2, "0")}`,
	);

	const traceState = activeSpanContext.traceState?.serialize();

	if (traceState) {
		headers.set("tracestate", traceState);
	}

	return new Request(request, { headers });
}

async function annotateRpcOperation(request: Request) {
	try {
		const activeSpan = trace.getSpan(context.active());
		const rootSpanContext = (
			activeSpan as
				| (typeof activeSpan & {
						readonly parentSpanContext?: SpanContext;
				  })
				| undefined
		)?.parentSpanContext;

		if (rootSpanContext === undefined || !isSpanContextValid(rootSpanContext)) {
			return;
		}

		const route = rpcTraceRouteFromBody(
			await request.clone().json(),
			(operation) => AppRpcs.requests.has(operation),
		);

		if (route !== undefined) {
			setRpcTraceRoute(rootSpanContext, route);
		}
	} catch {
		// Parsing and validation still belong to Effect RPC. If the envelope is
		// malformed, preserve its normal error response and the HTTP fallback name.
	}
}

export const POST = async (request: Request) => {
	await annotateRpcOperation(request);

	return handler(requestWithActiveServerTrace(request));
};

export const disposeRpcRoute = webHandler.dispose;
