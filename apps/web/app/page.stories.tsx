import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { HomeView } from "./home-view";

const meta = {
	title: "Web/Home",
	component: HomeView,
	parameters: {
		nextjs: {
			appDirectory: true,
		},
	},
	args: {
		email: "user@example.com",
	},
} satisfies Meta<typeof HomeView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;
