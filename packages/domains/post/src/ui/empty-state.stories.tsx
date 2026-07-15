import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PostEmptyState } from "./empty-state.js";

const meta = {
	title: "Post/EmptyState",
	component: PostEmptyState,
	tags: ["autodocs"],
	args: {
		onCreate: () => undefined,
	},
} satisfies Meta<typeof PostEmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty = {} satisfies Story;
