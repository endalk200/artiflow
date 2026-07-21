import { describe, expect, it } from "vitest";

import {
	DEFAULT_OTLP_HTTP_ENDPOINT,
	InvalidOtlpHttpEndpoint,
	OTLP_ENDPOINT_ENV,
	OTLP_LOGS_ENDPOINT_ENV,
	OTLP_TRACES_ENDPOINT_ENV,
	OTEL_SDK_DISABLED_ENV,
	isOtelSdkDisabled,
	resolveOtlpHttpEndpoints,
} from "./index";

describe("resolveOtlpHttpEndpoints", () => {
	it("defaults traces and logs to the local OTLP HTTP receiver", () => {
		expect(resolveOtlpHttpEndpoints({})).toEqual({
			logs: `${DEFAULT_OTLP_HTTP_ENDPOINT}/v1/logs`,
			traces: `${DEFAULT_OTLP_HTTP_ENDPOINT}/v1/traces`,
		});
	});

	it("treats the general endpoint as a base URL", () => {
		expect(
			resolveOtlpHttpEndpoints({
				[OTLP_ENDPOINT_ENV]: "https://collector.example.com/tenant",
			}),
		).toEqual({
			logs: "https://collector.example.com/tenant/v1/logs",
			traces: "https://collector.example.com/tenant/v1/traces",
		});
	});

	it("preserves the base endpoint path and query while appending signal paths", () => {
		expect(
			resolveOtlpHttpEndpoints({
				[OTLP_ENDPOINT_ENV]:
					"https://collector.example.com/tenant?token=opaque",
			}),
		).toEqual({
			logs: "https://collector.example.com/tenant/v1/logs?token=opaque",
			traces: "https://collector.example.com/tenant/v1/traces?token=opaque",
		});
	});

	it("uses signal-specific endpoint URLs without appending a path", () => {
		expect(
			resolveOtlpHttpEndpoints({
				[OTLP_ENDPOINT_ENV]: "http://collector:4318",
				[OTLP_LOGS_ENDPOINT_ENV]: "https://logs.example.com/intake",
				[OTLP_TRACES_ENDPOINT_ENV]: "https://traces.example.com/",
			}),
		).toEqual({
			logs: "https://logs.example.com/intake",
			traces: "https://traces.example.com/",
		});
	});

	it("rejects malformed and non-HTTP endpoint URLs", () => {
		expect(() =>
			resolveOtlpHttpEndpoints({
				[OTLP_ENDPOINT_ENV]: "collector:4318",
			}),
		).toThrow(InvalidOtlpHttpEndpoint);
		expect(() =>
			resolveOtlpHttpEndpoints({
				[OTLP_TRACES_ENDPOINT_ENV]: "file:///tmp/traces",
			}),
		).toThrow(InvalidOtlpHttpEndpoint);
	});
});

describe("isOtelSdkDisabled", () => {
	it("only disables telemetry for a case-insensitive true value", () => {
		expect(isOtelSdkDisabled({ [OTEL_SDK_DISABLED_ENV]: " TRUE " })).toBe(true);
		expect(isOtelSdkDisabled({ [OTEL_SDK_DISABLED_ENV]: "false" })).toBe(false);
		expect(isOtelSdkDisabled({})).toBe(false);
	});
});
