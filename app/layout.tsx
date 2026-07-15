import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import "katex/dist/katex.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MDX Lab",
    template: "%s | MDX Lab",
  },
  description: "A small Next.js and Fumadocs MDX rendering experiment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
