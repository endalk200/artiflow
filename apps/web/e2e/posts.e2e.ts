import { expect, test } from "@playwright/test";

test("manages posts through the browser", async ({ page }) => {
	const postTitle = `Playwright post ${Date.now()}`;
	const updatedTitle = `Updated ${postTitle}`;

	await page.goto("/");

	await expect(page.getByText(/@example\.com/)).toBeVisible();

	const emptyNewButton = page.getByTestId("posts-empty-new-button");
	const headerNewButton = page.getByTestId("posts-new-button");

	if (await emptyNewButton.isVisible()) {
		await emptyNewButton.click();
	} else {
		await headerNewButton.click();
	}

	await page.getByTestId("post-form-title-input").fill(postTitle);
	await page
		.getByTestId("post-form-content-input")
		.fill("Created from an E2E test.");
	await page.getByTestId("post-form-save-button").click();

	const createdRow = page
		.getByTestId("post-row")
		.filter({ hasText: postTitle });
	await expect(createdRow).toBeVisible();

	await createdRow.getByTestId("post-row-title-button").click();
	await expect(page.getByTestId("post-detail")).toContainText(postTitle);
	await expect(page.getByTestId("post-detail")).toContainText(
		"Created from an E2E test.",
	);

	await page.getByTestId("post-detail-edit-button").click();
	await page.getByTestId("post-form-title-input").fill(updatedTitle);
	await page
		.getByTestId("post-form-content-input")
		.fill("Updated from an E2E test.");
	await page.getByTestId("post-form-save-button").click();

	await expect(page.getByTestId("post-detail")).toContainText(updatedTitle);
	await expect(page.getByTestId("post-detail")).toContainText(
		"Updated from an E2E test.",
	);

	await page.getByTestId("post-detail-delete-button").click();
	await expect(page.getByTestId("delete-post-dialog")).toBeVisible();
	await page.getByTestId("delete-post-confirm-button").click();

	await expect(
		page.getByTestId("post-row").filter({ hasText: updatedTitle }),
	).toHaveCount(0);
});
