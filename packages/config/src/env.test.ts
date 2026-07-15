import { afterEach, describe, expect, it, vi } from "vitest";

const completeEnv = {
	AUTH_EMAIL_FROM: "LaunchKey <auth@example.com>",
	BETTER_AUTH_SECRET: "development-secret",
	BETTER_AUTH_URL: "http://localhost:3000",
	DATABASE_URL: "postgresql://user:pass@localhost:5432/app?schema=public",
	NEXT_PUBLIC_APP_URL: "http://localhost:3000",
	NODE_ENV: "development",
	RESEND_API_KEY: "re_test",
} as const;

describe("application environment", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	async function importEnvModule() {
		for (const [key, value] of Object.entries(completeEnv)) {
			vi.stubEnv(key, value);
		}

		return import("./env.ts");
	}

	it("accepts a complete environment", async () => {
		const { createAppEnv } = await importEnvModule();
		const env = createAppEnv(completeEnv);

		expect(env).toMatchObject({
			AUTH_EMAIL_FROM: "LaunchKey <auth@example.com>",
			BETTER_AUTH_SECRET: "development-secret",
			BETTER_AUTH_URL: "http://localhost:3000",
			DATABASE_URL: "postgresql://user:pass@localhost:5432/app?schema=public",
			NEXT_PUBLIC_APP_URL: "http://localhost:3000",
			RESEND_API_KEY: "re_test",
		});
	});

	it.each([
		"DATABASE_URL",
		"BETTER_AUTH_URL",
		"NEXT_PUBLIC_APP_URL",
		"BETTER_AUTH_SECRET",
		"RESEND_API_KEY",
		"AUTH_EMAIL_FROM",
	] as const)("requires %s", async (name) => {
		const { createAppEnv } = await importEnvModule();
		const runtimeEnv = { ...completeEnv, [name]: " " };

		expect(() => {
			const env = createAppEnv(runtimeEnv);

			return env[name];
		}).toThrow(new RegExp(name));
	});

	it("reports the invalid variable and validation reason", async () => {
		const { createAppEnv } = await importEnvModule();

		expect(() => {
			createAppEnv({ ...completeEnv, NEXT_PUBLIC_APP_URL: " " });
		}).toThrow(
			"Invalid application environment variables:\n- NEXT_PUBLIC_APP_URL: NEXT_PUBLIC_APP_URL is required.",
		);
	});
});
