export const DEFAULT_OTLP_HTTP_ENDPOINT = "http://127.0.0.1:4318";
export const ARTIFLOW_SERVICE_NAMESPACE = "artiflow";

export const OTLP_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_ENDPOINT";
export const OTLP_LOGS_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT";
export const OTLP_TRACES_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT";
export const OTEL_SDK_DISABLED_ENV = "OTEL_SDK_DISABLED";

export type TelemetryEnvironment = Readonly<Record<string, string | undefined>>;

export type OtlpHttpEndpoints = {
	readonly logs: string;
	readonly traces: string;
};

export class InvalidOtlpHttpEndpoint extends Error {
	readonly environmentVariable: string;

	constructor(environmentVariable: string) {
		super(
			`Invalid ${environmentVariable}. Expected an absolute HTTP or HTTPS URL.`,
		);
		this.name = "InvalidOtlpHttpEndpoint";
		this.environmentVariable = environmentVariable;
	}
}

export const isOtelSdkDisabled = (
	environment: TelemetryEnvironment = process.env,
) => environment[OTEL_SDK_DISABLED_ENV]?.trim().toLowerCase() === "true";

const normalizeEndpoint = (environmentVariable: string, value: string) => {
	const configured = value.trim();
	try {
		const url = new URL(configured);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new InvalidOtlpHttpEndpoint(environmentVariable);
		}
		return url.toString();
	} catch (error) {
		if (error instanceof InvalidOtlpHttpEndpoint) throw error;
		throw new InvalidOtlpHttpEndpoint(environmentVariable);
	}
};

const resolveSignalEndpoint = (
	environment: TelemetryEnvironment,
	signalEnvironmentVariable: string,
	signalPath: string,
) => {
	const signalEndpoint = environment[signalEnvironmentVariable];
	if (signalEndpoint !== undefined) {
		return normalizeEndpoint(signalEnvironmentVariable, signalEndpoint);
	}

	const baseEndpoint = normalizeEndpoint(
		OTLP_ENDPOINT_ENV,
		environment[OTLP_ENDPOINT_ENV] ?? DEFAULT_OTLP_HTTP_ENDPOINT,
	);
	const url = new URL(baseEndpoint);
	url.pathname = `${url.pathname.replace(/\/$/, "")}/${signalPath}`;
	return url.toString();
};

/**
 * Resolves OTLP/HTTP signal URLs according to the OpenTelemetry exporter spec:
 * signal-specific endpoints are used as-is, while the general endpoint is a
 * base URL that receives the standard `v1/traces` and `v1/logs` suffixes.
 */
export const resolveOtlpHttpEndpoints = (
	environment: TelemetryEnvironment = process.env,
): OtlpHttpEndpoints => ({
	logs: resolveSignalEndpoint(environment, OTLP_LOGS_ENDPOINT_ENV, "v1/logs"),
	traces: resolveSignalEndpoint(
		environment,
		OTLP_TRACES_ENDPOINT_ENV,
		"v1/traces",
	),
});
