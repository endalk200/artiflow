import type { Metadata } from "next";

import "@app/ui/globals.css";

import { SiteHeader } from "../components/site/site-header";

export const metadata: Metadata = {
	title: {
		default: "Artiflow",
		template: "%s · Artiflow",
	},
	description:
		"Visual documents for agent-authored plans, reports, reviews, and explanations.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="font-sans antialiased">
			<body className="flex min-h-screen flex-col bg-background">
				<SiteHeader />
				<div className="flex-1">{children}</div>
			</body>
		</html>
	);
}
