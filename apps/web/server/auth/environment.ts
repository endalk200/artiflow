const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEFAULT_DATABASE_URL =
	"postgresql://artiflow:artiflow@localhost:5432/artiflow";

export interface AuthEnvironment {
	readonly baseURL: string;
	readonly databaseURL: string;
	readonly githubClientId: string;
	readonly githubClientSecret: string;
	readonly secret: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string): string {
	const value = environment[name]?.trim();
	if (!value) {
		throw new Error(`${name} must be configured`);
	}
	return value;
}

function parseBaseURL(value: string): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new Error("BETTER_AUTH_URL must be an absolute URL");
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("BETTER_AUTH_URL must use http or https");
	}
	if (url.protocol === "http:" && !LOOPBACK_HOSTNAMES.has(url.hostname)) {
		throw new Error("BETTER_AUTH_URL must use https outside local development");
	}
	if (
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error(
			"BETTER_AUTH_URL must be an origin without a path or credentials",
		);
	}

	return url.origin;
}

export function resolveAuthEnvironment(
	environment: Environment,
): AuthEnvironment {
	const secret = required(environment, "BETTER_AUTH_SECRET");
	if (secret.length < 32) {
		throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
	}

	return {
		baseURL: parseBaseURL(required(environment, "BETTER_AUTH_URL")),
		databaseURL: environment.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL,
		githubClientId: required(environment, "GITHUB_CLIENT_ID"),
		githubClientSecret: required(environment, "GITHUB_CLIENT_SECRET"),
		secret,
	};
}

export const authEnvironment = resolveAuthEnvironment(process.env);
