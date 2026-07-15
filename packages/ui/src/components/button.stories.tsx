import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "./button.js";

const meta = {
	title: "UI/Button",
	component: Button,
	tags: ["autodocs"],
	args: {
		children: "Button",
	},
	argTypes: {
		variant: {
			control: "select",
			options: [
				"default",
				"outline",
				"secondary",
				"ghost",
				"destructive",
				"destructive-ghost",
				"link",
			],
		},
		size: {
			control: "select",
			options: [
				"default",
				"xs",
				"sm",
				"lg",
				"icon",
				"icon-xs",
				"icon-sm",
				"icon-lg",
			],
		},
	},
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const Variants = {
	parameters: {
		a11y: {
			test: "todo",
		},
	},
	render: () => (
		<div className="flex flex-wrap items-center gap-2">
			<Button>Default</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="destructive">Destructive</Button>
			<Button variant="destructive-ghost">Destructive ghost</Button>
			<Button variant="link">Link</Button>
		</div>
	),
} satisfies Story;

export const Sizes = {
	render: () => (
		<div className="flex flex-wrap items-center gap-2">
			<Button size="xs">Extra small</Button>
			<Button size="sm">Small</Button>
			<Button>Default</Button>
			<Button size="lg">Large</Button>
		</div>
	),
} satisfies Story;
