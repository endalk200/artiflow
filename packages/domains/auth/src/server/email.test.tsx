import { afterEach, describe, expect, it, vi } from "vitest";

const { resendMock, sendEmailMock } = vi.hoisted(() => {
	const sendEmailMock = vi.fn();
	const resendMock = vi.fn(function ResendMock() {
		return {
			emails: {
				send: sendEmailMock,
			},
		};
	});

	return { resendMock, sendEmailMock };
});

vi.mock("resend", () => ({
	Resend: resendMock,
}));

describe("sendAuthEmail", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
		sendEmailMock.mockReset();
		resendMock.mockClear();
		vi.resetModules();
	});

	it("sends auth email through Resend when configured", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv(
			"DATABASE_URL",
			"postgresql://user:pass@localhost:5432/app?schema=public",
		);
		vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
		vi.stubEnv("BETTER_AUTH_SECRET", "development-secret");
		vi.stubEnv("RESEND_API_KEY", "re_test");
		vi.stubEnv("AUTH_EMAIL_FROM", "LaunchKey <auth@example.com>");
		sendEmailMock.mockResolvedValueOnce({
			data: { id: "email-id" },
			error: null,
			headers: null,
		});
		const { sendAuthEmail } = await import("./email.tsx");

		await sendAuthEmail({
			kind: "email-verification",
			to: "user@example.com",
			url: "http://localhost:3000/api/auth/verify-email?token=test-token",
		});

		expect(resendMock).toHaveBeenCalledWith("re_test");
		expect(sendEmailMock).toHaveBeenCalledWith(
			expect.objectContaining({
				from: "LaunchKey <auth@example.com>",
				subject: "Verify your LaunchKey email",
				to: "user@example.com",
			}),
		);
	});

	it("throws a clear error when Resend returns an API-level error", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv(
			"DATABASE_URL",
			"postgresql://user:pass@localhost:5432/app?schema=public",
		);
		vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
		vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
		vi.stubEnv("BETTER_AUTH_SECRET", "development-secret");
		vi.stubEnv("RESEND_API_KEY", "re_test");
		vi.stubEnv("AUTH_EMAIL_FROM", "LaunchKey <auth@example.com>");
		sendEmailMock.mockResolvedValueOnce({
			data: null,
			error: {
				message: "Invalid API key",
				name: "invalid_api_key",
				statusCode: 401,
			},
			headers: null,
		});
		const { sendAuthEmail } = await import("./email.tsx");

		await expect(
			sendAuthEmail({
				kind: "password-reset",
				to: "user@example.com",
				url: "http://localhost:3000/api/auth/reset-password?token=test-token",
			}),
		).rejects.toThrow(
			"Resend failed to send auth email: invalid_api_key (status 401): Invalid API key",
		);
	});
});
