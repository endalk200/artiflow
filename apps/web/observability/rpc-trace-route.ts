const rpcTraceRoutePrefix = "/__artiflow_rpc__/";

export const rpcHttpRoute = "/api/rpc";

export type RpcTraceRouteSummary = {
	readonly operations: ReadonlyArray<string>;
	readonly requestCount: number;
};

type RpcRequestEnvelope = {
	readonly _tag: "Request";
	readonly tag: string;
};

function isRpcRequestEnvelope(value: unknown): value is RpcRequestEnvelope {
	return (
		typeof value === "object" &&
		value !== null &&
		"_tag" in value &&
		value._tag === "Request" &&
		"tag" in value &&
		typeof value.tag === "string"
	);
}

/**
 * Encodes a validated RPC request summary for the short-lived process bridge.
 * The span processor decodes it, preserves `/api/rpc` as the HTTP route, and
 * promotes the operation name onto the root request span.
 */
export function rpcTraceRouteFromBody(
	body: unknown,
	isKnownOperation: (operation: string) => boolean,
): string | undefined {
	const requests = Array.isArray(body) ? body : [body];

	if (requests.length === 0) {
		return undefined;
	}

	const operations: Array<string> = [];

	for (const request of requests) {
		if (!isRpcRequestEnvelope(request) || !isKnownOperation(request.tag)) {
			return undefined;
		}

		operations.push(request.tag);
	}

	const summary: RpcTraceRouteSummary = {
		operations: [...new Set(operations)].sort(),
		requestCount: operations.length,
	};

	return `${rpcTraceRoutePrefix}${encodeURIComponent(JSON.stringify(summary))}`;
}

export function rpcTraceSummaryFromRoute(
	route: unknown,
): RpcTraceRouteSummary | undefined {
	if (typeof route !== "string" || !route.startsWith(rpcTraceRoutePrefix)) {
		return undefined;
	}

	try {
		const value: unknown = JSON.parse(
			decodeURIComponent(route.slice(rpcTraceRoutePrefix.length)),
		);

		if (
			typeof value !== "object" ||
			value === null ||
			!("operations" in value) ||
			!Array.isArray(value.operations) ||
			value.operations.length === 0 ||
			!value.operations.every(
				(operation) => typeof operation === "string" && operation.length > 0,
			) ||
			!("requestCount" in value) ||
			typeof value.requestCount !== "number" ||
			!Number.isSafeInteger(value.requestCount) ||
			value.requestCount < value.operations.length
		) {
			return undefined;
		}

		return {
			operations: value.operations,
			requestCount: value.requestCount,
		};
	} catch {
		return undefined;
	}
}
