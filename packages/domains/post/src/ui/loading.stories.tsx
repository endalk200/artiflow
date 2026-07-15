import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PostListLoading } from "./loading.js";

const meta = {
	title: "Post/Loading",
	component: PostListLoading,
	tags: ["autodocs"],
} satisfies Meta<typeof PostListLoading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading = {} satisfies Story;
