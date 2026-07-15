import type { StorybookConfig } from "@storybook/nextjs-vite";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

function getAbsolutePath(value: string) {
	return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
	stories: [
		{
			directory: "../",
			files: "{app,components,src}/**/*.stories.@(js|jsx|mjs|ts|tsx)",
			titlePrefix: "Web",
		},
		{
			directory: "../../../packages",
			files: "{*,domains/*,shared/*}/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
			titlePrefix: "Packages",
		},
	],
	addons: [
		getAbsolutePath("@chromatic-com/storybook"),
		getAbsolutePath("@storybook/addon-vitest"),
		getAbsolutePath("@storybook/addon-a11y"),
		getAbsolutePath("@storybook/addon-docs"),
	],
	framework: {
		name: getAbsolutePath("@storybook/nextjs-vite"),
		options: {},
	},
};

export default config;
