import { defineConfig, devices } from "@playwright/test";

import { e2eBaseUrl } from "./e2e/config";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["list"], ["html", { open: "never" }]],
	outputDir: "test-results",
	use: {
		baseURL: e2eBaseUrl,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			testMatch: /.*\.e2e\.tsx?/,
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
	webServer: {
		command: "bun run e2e:server",
		url: e2eBaseUrl,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
