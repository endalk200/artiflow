import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url:
			process.env.DATABASE_URL ??
			"postgresql://launchkey:launchkey@localhost:5432/launchkey?schema=public",
	},
});
