import type { Metadata } from "next";

import "@app/ui/globals.css";
import { Geist } from "next/font/google";
import { cn } from "@app/ui/lib/utils";
import { Providers } from "./provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "App",
	description: "Description",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={cn("font-sans", geist.variable)}>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
