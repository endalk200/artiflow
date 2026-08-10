import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname =
	typeof __dirname !== "undefined"
		? __dirname
		: path.dirname(fileURLToPath(import.meta.url));
const storybookConfigDir = path.join(dirname, ".storybook");

export default defineConfig({
	plugins: [react()],
	optimizeDeps: {
		include: ["@tanstack/react-query"],
	},
	test: {
		env: {
			BETTER_AUTH_SECRET:
				"unit-test-secret-that-is-at-least-thirty-two-characters",
			BETTER_AUTH_URL: "http://localhost:3000",
			DATABASE_URL:
				process.env.DATABASE_TEST_URL ??
				"postgresql://artiflow:artiflow@localhost:5432/artiflow_test",
			GITHUB_CLIENT_ID: "github-test-client-id",
			GITHUB_CLIENT_SECRET: "github-test-client-secret",
		},
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					exclude: ["e2e/**", "node_modules/**", "**/*.integration.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "integration",
					include: ["**/*.integration.test.ts"],
				},
			},
			{
				extends: true,
				plugins: [
					storybookTest({
						configDir: storybookConfigDir,
						storybookScript: "bun run storybook -- --no-open",
					}),
				],
				test: {
					name: `storybook:${storybookConfigDir}`,
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: "chromium",
							},
						],
					},
				},
			},
		],
	},
});
