import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	distDir: process.env.ARTIFLOW_NEXT_DIST_DIR ?? ".next",
	serverExternalPackages: ["mermaid"],
};

export default nextConfig;
