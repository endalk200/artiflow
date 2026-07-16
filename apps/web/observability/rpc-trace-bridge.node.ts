import type { SpanContext } from "@opentelemetry/api";
import process from "node:process";

const registryProperty = "__artiflowRpcTraceRoutes";
const entryLifetimeMs = 60_000;

type RegistryEntry = {
	readonly expiresAt: number;
	readonly route: string;
};

type ProcessWithRpcTraceRoutes = typeof process & {
	[registryProperty]?: Map<string, RegistryEntry>;
};

function spanKey(spanContext: SpanContext) {
	return `${spanContext.traceId}:${spanContext.spanId}`;
}

function registry() {
	const sharedProcess = process as ProcessWithRpcTraceRoutes;

	sharedProcess[registryProperty] ??= new Map();

	return sharedProcess[registryProperty];
}

function deleteExpiredEntries(
	entries: Map<string, RegistryEntry>,
	now: number,
) {
	for (const [key, entry] of entries) {
		if (entry.expiresAt <= now) {
			entries.delete(key);
		}
	}
}

/**
 * Passes a bounded, validated operation summary from the bundled route module
 * to the instrumentation module. `process` is shared by Next's server module
 * realms even when their `globalThis` objects and module caches are isolated.
 */
export function setRpcTraceRoute(
	rootSpanContext: SpanContext,
	route: string,
): void {
	const entries = registry();
	const now = Date.now();

	deleteExpiredEntries(entries, now);
	entries.set(spanKey(rootSpanContext), {
		expiresAt: now + entryLifetimeMs,
		route,
	});
}

export function takeRpcTraceRoute(
	rootSpanContext: SpanContext,
): string | undefined {
	const entries = registry();
	const key = spanKey(rootSpanContext);
	const entry = entries.get(key);

	entries.delete(key);

	return entry !== undefined && entry.expiresAt > Date.now()
		? entry.route
		: undefined;
}
