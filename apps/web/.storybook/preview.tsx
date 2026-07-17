import type { Preview } from "@storybook/nextjs-vite";
import "@app/ui/globals.css";

const preview: Preview = {
	decorators: [
		(Story) => (
			<div className="bg-background font-sans text-foreground">
				<Story />
			</div>
		),
	],
	parameters: {
		nextjs: {
			appDirectory: true,
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},

		a11y: {
			test: "error",
		},
	},
};

export default preview;
