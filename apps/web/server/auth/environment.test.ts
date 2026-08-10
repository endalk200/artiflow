import { describe, expect, it } from "vitest";

import { resolveAuthEnvironment } from "./environment";

const validEnvironment = {
	BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
	BETTER_AUTH_URL: "https://artiflow.example",
	DATABASE_URL: "postgresql://artiflow:secret@database.example/artiflow",
	GITHUB_CLIENT_ID: "github-client-id",
	GITHUB_CLIENT_SECRET: "github-client-secret",
};

describe("resolveAuthEnvironment", () => {
	it("resolves a complete production configuration", () => {
		expect(resolveAuthEnvironment(validEnvironment)).toEqual({
			baseURL: "https://artiflow.example",
			databaseURL: validEnvironment.DATABASE_URL,
			githubClientId: validEnvironment.GITHUB_CLIENT_ID,
			githubClientSecret: validEnvironment.GITHUB_CLIENT_SECRET,
			secret: validEnvironment.BETTER_AUTH_SECRET,
		});
	});

	it.each([
		"BETTER_AUTH_SECRET",
		"BETTER_AUTH_URL",
		"GITHUB_CLIENT_ID",
		"GITHUB_CLIENT_SECRET",
	] as const)("rejects a missing %s", (name) => {
		expect(() =>
			resolveAuthEnvironment({ ...validEnvironment, [name]: "" }),
		).toThrow(`${name} must be configured`);
	});

	it("uses the same local database default as the application runtime", () => {
		expect(
			resolveAuthEnvironment({ ...validEnvironment, DATABASE_URL: "" })
				.databaseURL,
		).toBe("postgresql://artiflow:artiflow@localhost:5432/artiflow");
	});

	it("rejects a short signing secret", () => {
		expect(() =>
			resolveAuthEnvironment({
				...validEnvironment,
				BETTER_AUTH_SECRET: "short",
			}),
		).toThrow("BETTER_AUTH_SECRET must be at least 32 characters");
	});

	it.each([
		"http://artiflow.example",
		"ftp://artiflow.example",
		"https://user:password@artiflow.example",
		"https://artiflow.example/auth",
	])("rejects an unsafe public auth URL: %s", (baseURL) => {
		expect(() =>
			resolveAuthEnvironment({ ...validEnvironment, BETTER_AUTH_URL: baseURL }),
		).toThrow();
	});

	it.each([
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://[::1]:3000",
	])("allows a local HTTP auth URL: %s", (baseURL) => {
		expect(
			resolveAuthEnvironment({ ...validEnvironment, BETTER_AUTH_URL: baseURL })
				.baseURL,
		).toBe(baseURL);
	});
});
