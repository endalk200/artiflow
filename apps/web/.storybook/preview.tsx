import type { Preview } from "@storybook/nextjs-vite";
import { cn } from "@app/ui/lib/utils";
import "@app/ui/globals.css";
import { Geist } from "next/font/google";
import { Providers } from "../app/provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const preview: Preview = {
	decorators: [
		(Story) => (
			<div
				className={cn(
					"bg-background font-sans text-foreground",
					geist.variable,
				)}
			>
				<Providers>
					<Story />
				</Providers>
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
