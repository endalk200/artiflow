import type {
	ReadableSpan,
	Span,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { takeRpcTraceRoute } from "./rpc-trace-bridge.node";
import { rpcHttpRoute, rpcTraceSummaryFromRoute } from "./rpc-trace-route";

const nextRequestSpanType = "BaseServer.handleRequest";
const rpcServerSpanPrefix = "RpcServer.";
const rpcServerMarker = "artiflow.rpc.server";

function rpcOperation(span: Span) {
	if (
		span.attributes[rpcServerMarker] !== true ||
		!span.name.startsWith(rpcServerSpanPrefix)
	) {
		return undefined;
	}

	const operation = span.name.slice(rpcServerSpanPrefix.length);

	return operation.length > 0 ? operation : undefined;
}

function isNextRequestSpan(span: Span | ReadableSpan) {
	return span.attributes["next.span_type"] === nextRequestSpanType;
}

function applyRpcSpanAttributes(span: Span, operation: string) {
	span.setAttribute("rpc.method", operation);
	span.setAttribute("rpc.system.name", "effect");
}

/**
 * Promotes Effect RPC operation names onto Next's root request span so trace
 * list views show the application operation instead of the shared HTTP route.
 *
 * Next and the route handler can run with separate OpenTelemetry providers.
 * The route therefore passes a validated operation summary through a
 * short-lived process registry keyed by the root span context. The temporary
 * value is consumed by this processor and is never exported.
 */
export class RpcTraceNameProcessor implements SpanProcessor {
	onStart(span: Span): void {
		const operation = rpcOperation(span);

		if (operation === undefined) {
			return;
		}

		applyRpcSpanAttributes(span, operation);
	}

	onEnding(span: Span): void {
		const childOperation = rpcOperation(span);

		// Effect adds its configured RPC marker after the SDK's `onStart` hook.
		// Apply these attributes again at the reliable pre-export boundary.
		if (childOperation !== undefined) {
			applyRpcSpanAttributes(span, childOperation);
		}

		if (!isNextRequestSpan(span)) {
			return;
		}

		const route =
			takeRpcTraceRoute(span.spanContext()) ?? span.attributes["next.route"];
		const summary = rpcTraceSummaryFromRoute(route);

		if (summary === undefined) {
			return;
		}

		const operation = summary.operations[0];
		const name =
			summary.operations.length === 1 && operation !== undefined
				? operation
				: "RPC batch";

		span.updateName(name);
		span.setAttribute("next.span_name", name);
		span.setAttribute("next.route", rpcHttpRoute);
		span.setAttribute("http.route", rpcHttpRoute);
		span.setAttribute("rpc.system.name", "effect");
		span.setAttribute("artiflow.rpc.request_count", summary.requestCount);

		if (summary.operations.length === 1 && operation !== undefined) {
			span.setAttribute("rpc.method", operation);
		} else {
			span.setAttribute("artiflow.rpc.methods", [...summary.operations]);
		}
	}

	onEnd(_span: ReadableSpan): void {
		// Span names are finalized in onEnding; no post-export work is required.
	}

	forceFlush(): Promise<void> {
		return Promise.resolve();
	}

	shutdown(): Promise<void> {
		return Promise.resolve();
	}
}
