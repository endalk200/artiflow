import { AuthMiddlewareLive } from "@app/auth/server";
import { DatabaseLive } from "@app/database";
import {
	PostHandlers,
	PostOperationsLive,
	PostRepositoryPrisma,
	PostRpcs,
} from "@app/post/server";
import { context, isSpanContextValid, trace } from "@opentelemetry/api";
import { Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { OtelLive } from "../../../observability/otel.node.ts";

export const runtime = "nodejs";

const AppRpcs = PostRpcs;

const AppHandlers = PostHandlers;

const AppOperations = PostOperationsLive;

const AppRepositories = PostRepositoryPrisma;

const ServerLayer = RpcServer.layerHttp({
	group: AppRpcs,
	path: "/api/rpc",
	protocol: "http",
}).pipe(
	Layer.provide(AppHandlers),
	Layer.provide(AppOperations),
	Layer.provide(AppRepositories),
	Layer.provide(AuthMiddlewareLive),
	Layer.provide(DatabaseLive),
	Layer.provide(RpcSerialization.layerJson),
	Layer.provideMerge(OtelLive),
);

const webHandler = HttpRouter.toWebHandler(ServerLayer, {
	middleware: (effect) => HttpMiddleware.tracer(effect),
});
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

export const POST = (request: Request) =>
	handler(requestWithActiveServerTrace(request));

export const disposeRpcRoute = webHandler.dispose;
