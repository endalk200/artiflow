import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ??
			"postgresql://artiflow:artiflow@localhost:5432/artiflow",
	},
	out: "./drizzle",
	schema: "./server/database/schema.ts",
});
