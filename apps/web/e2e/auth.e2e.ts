import { expect, test } from "@playwright/test";

test.describe("anonymous authentication", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects the post manager to sign in", async ({ page }) => {
		await page.goto("/");

		await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2F/);
		await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	});

	test("rejects an invalid Better Auth session cookie", async ({
		context,
		page,
	}) => {
		await context.addCookies([
			{
				name: "better-auth.session_token",
				value: "invalid-session-token",
				domain: "127.0.0.1",
				path: "/",
				httpOnly: true,
				sameSite: "Lax",
			},
		]);

		await page.goto("/");

		await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2F/);
		await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	});

	test("validates sign-up input before submitting", async ({ page }) => {
		await page.goto("/sign-up");

		await page.getByTestId("sign-up-email-input").fill("not-an-email");
		await page.getByTestId("sign-up-email-input").blur();
		await page.getByTestId("sign-up-password-input").fill("short");
		await page.getByTestId("sign-up-password-input").blur();

		await expect(page.getByText("Enter a valid email.")).toBeVisible();
		await expect(
			page.getByText("Password must be at least 8 characters."),
		).toBeVisible();
	});

	test("shows forgot-password confirmation without revealing accounts", async ({
		page,
	}) => {
		await page.goto("/forgot-password");

		await page
			.getByTestId("forgot-password-email-input")
			.fill(`missing-${Date.now()}@example.com`);
		await page.getByRole("button", { name: "Send reset link" }).click();

		await expect(
			page.getByText("If that account exists, a reset link is on its way."),
		).toBeVisible();
	});
});

test.describe("authenticated authentication", () => {
	test("redirects authenticated users away from sign-in", async ({ page }) => {
		await page.goto("/sign-in?callbackURL=%2F");

		await expect(page).toHaveURL("/");
		await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
	});

	test("signs out and requires authentication again", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();

		await page.getByRole("button", { name: "Sign out" }).click();

		await expect(page).toHaveURL(/\/sign-in/);

		await page.goto("/");

		await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2F/);
	});
});
