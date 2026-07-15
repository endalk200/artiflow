import { test as setup } from "@playwright/test";
import nextEnv from "@next/env";
import { createPrismaClient } from "@app/database";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const authFile = fileURLToPath(
	new URL("../test-results/.auth/user.json", import.meta.url),
);
const { loadEnvConfig } = nextEnv as typeof import("@next/env");

setup("authenticate", async ({ context }) => {
	loadEnvConfig(process.cwd());

	const { testAuth } = await import("@app/auth/test");
	const authContext = await testAuth.$context;
	const id = `e2e-user-${Date.now()}`;
	const user = authContext.test.createUser({
		id,
		email: `${id}@example.com`,
		name: "Playwright User",
		emailVerified: true,
	});

	try {
		await cleanupOldE2eUsers();
		await authContext.test.saveUser(user);
	} catch (error) {
		throw new Error(
			[
				"Could not create the Better Auth e2e user.",
				"Make sure the e2e Postgres database is running and migrations have been applied.",
				`Original error: ${describeError(error)}`,
			].join("\n"),
			{ cause: error },
		);
	}

	const cookies = await authContext.test.getCookies({
		userId: user.id,
		domain: "127.0.0.1",
	});

	await context.addCookies(
		cookies.map((cookie) => ({
			...cookie,
			domain: "127.0.0.1",
			path: cookie.path || "/",
			sameSite: cookie.sameSite ?? "Lax",
		})),
	);

	await mkdir(dirname(authFile), { recursive: true });
	await context.storageState({ path: authFile });
});

async function cleanupOldE2eUsers() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		return;
	}

	const prisma = createPrismaClient(databaseUrl);

	try {
		await prisma.user.deleteMany({
			where: {
				email: {
					startsWith: "e2e-user-",
				},
			},
		});
	} finally {
		await prisma.$disconnect();
	}
}

function describeError(error: unknown) {
	if (!(error instanceof Error)) {
		return String(error);
	}

	const details: string[] = [error.message.trim()];

	if ("code" in error && typeof error.code === "string") {
		details.push(`code=${error.code}`);
	}

	if ("meta" in error && error.meta !== undefined) {
		details.push(`meta=${JSON.stringify(error.meta)}`);
	}

	return details.filter(Boolean).join(" ");
}
