import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

import { e2eBaseUrl } from "./config";

const cliEntrypoint = fileURLToPath(
	new URL("../../cli/src/bin.ts", import.meta.url),
);

const database = new Pool({
	connectionString:
		process.env.DATABASE_URL ??
		"postgresql://artiflow:artiflow@localhost:5432/artiflow",
});
const testUserId = `usr_e2e_${crypto.randomUUID()}`;
const testSessionId = `ses_e2e_${crypto.randomUUID()}`;
const testSessionToken = `artiflow-e2e-${crypto.randomUUID()}`;
const testSessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
const authorizationHeaders = {
	authorization: `Bearer ${testSessionToken}`,
};

test.beforeAll(async () => {
	const now = new Date();
	await database.query(
		`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $5)`,
		[testUserId, "Artiflow E2E", `${testUserId}@example.test`, true, now],
	);
	await database.query(
		`INSERT INTO "session" (id, token, expires_at, created_at, updated_at, user_id)
		 VALUES ($1, $2, $3, $4, $4, $5)`,
		[testSessionId, testSessionToken, testSessionExpiresAt, now, testUserId],
	);
});

test.afterAll(async () => {
	await database.query(`DELETE FROM "user" WHERE id = $1`, [testUserId]);
	await database.end();
});

const runCli = (
	args: ReadonlyArray<string>,
	cwd: string,
	credentialsPath: string,
) => {
	const result = spawnSync("bun", [cliEntrypoint, ...args], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			ARTIFLOW_BASE_URL: e2eBaseUrl,
			ARTIFLOW_CREDENTIALS_PATH: credentialsPath,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
	return JSON.parse(result.stdout) as Record<string, unknown>;
};

const writeCliCredential = async (workingDirectory: string) => {
	const credentialsPath = join(workingDirectory, "credentials.json");
	await writeFile(
		credentialsPath,
		`${JSON.stringify(
			{
				credentials: {
					[e2eBaseUrl]: {
						accessToken: testSessionToken,
						expiresAt: testSessionExpiresAt.toISOString(),
					},
				},
				schemaVersion: 1,
			},
			null,
			2,
		)}\n`,
		{ mode: 0o600 },
	);
	expect((await stat(credentialsPath)).mode & 0o777).toBe(0o600);
	return credentialsPath;
};

const waitForDeviceInstructions = (
	readOutput: () => string,
	isRunning: () => boolean,
) =>
	new Promise<{ readonly userCode: string; readonly verificationUri: string }>(
		(resolve, reject) => {
			const deadline = Date.now() + 10_000;
			const inspect = () => {
				const output = readOutput();
				const verificationUri = /Visit (https?:\/\/\S+)/.exec(output)?.[1];
				const userCode = /Enter code: ([A-Z2-9-]+)/.exec(output)?.[1];
				if (verificationUri !== undefined && userCode !== undefined) {
					resolve({ userCode, verificationUri });
					return;
				}
				if (!isRunning()) {
					reject(
						new Error(
							`CLI exited before showing device instructions: ${output}`,
						),
					);
					return;
				}
				if (Date.now() >= deadline) {
					reject(
						new Error(
							"CLI did not show device instructions within 10 seconds.",
						),
					);
					return;
				}
				setTimeout(inspect, 25);
			};
			inspect();
		},
	);

const within = <T>(
	promise: Promise<T>,
	milliseconds: number,
	message: string,
) =>
	new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(message)), milliseconds);
		promise.then(
			(value) => {
				clearTimeout(timeout);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timeout);
				reject(error);
			},
		);
	});

test("CLI device login completes through browser approval without exposing tokens", async ({
	page,
}, testInfo) => {
	testInfo.setTimeout(30_000);
	const workingDirectory = await mkdtemp(
		join(tmpdir(), "artiflow-e2e-device-login-"),
	);
	const credentialsPath = join(workingDirectory, "credentials.json");
	let stdout = "";
	let stderr = "";
	let running = true;
	const cli = spawn("bun", [cliEntrypoint, "auth", "login", "--no-open"], {
		cwd: workingDirectory,
		env: {
			...process.env,
			ARTIFLOW_BASE_URL: e2eBaseUrl,
			ARTIFLOW_CREDENTIALS_PATH: credentialsPath,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	cli.stdout.setEncoding("utf8");
	cli.stderr.setEncoding("utf8");
	cli.stdout.on("data", (chunk: string) => {
		stdout += chunk;
	});
	cli.stderr.on("data", (chunk: string) => {
		stderr += chunk;
	});
	const exit = new Promise<number | null>((resolve) => {
		cli.once("exit", (code) => {
			running = false;
			resolve(code);
		});
	});

	try {
		const instructions = await waitForDeviceInstructions(
			() => stdout,
			() => running,
		);
		const verificationUri = new URL(instructions.verificationUri);
		expect(verificationUri.origin).toBe(e2eBaseUrl);
		expect(verificationUri.pathname).toBe("/device");

		const deviceResult = await database.query<{ readonly device_code: string }>(
			`SELECT device_code FROM device_code WHERE user_code = $1`,
			[instructions.userCode.replaceAll("-", "")],
		);
		expect(deviceResult.rowCount).toBe(1);
		const deviceCode = deviceResult.rows[0]?.device_code;
		if (deviceCode === undefined)
			throw new Error("Device code was not persisted.");

		await page.setExtraHTTPHeaders(authorizationHeaders);
		await page.goto(
			`/device?user_code=${encodeURIComponent(instructions.userCode)}`,
		);
		await page.getByRole("button", { name: "Continue" }).click();
		await expect(
			page.getByRole("heading", { name: "Authorize this CLI?" }),
		).toBeVisible();
		await page.getByRole("button", { name: "Approve" }).click();
		await expect(
			page.getByRole("heading", { name: "Device authorized" }),
		).toBeVisible();

		const exitCode = await within(
			exit,
			15_000,
			"CLI did not finish within 15 seconds.",
		);
		expect(exitCode, stderr).toBe(0);
		expect(stdout).toContain(`Authenticated with ${e2eBaseUrl}.`);

		const credentialFile = JSON.parse(
			await readFile(credentialsPath, "utf8"),
		) as {
			readonly credentials: Record<
				string,
				{ readonly accessToken: string; readonly expiresAt: string }
			>;
		};
		const credential = credentialFile.credentials[e2eBaseUrl];
		if (credential === undefined) {
			throw new Error("CLI did not persist a credential for the E2E server.");
		}
		expect(credential.accessToken).not.toBe("");
		expect(Date.parse(credential?.expiresAt ?? "")).toBeGreaterThan(Date.now());
		expect((await stat(credentialsPath)).mode & 0o777).toBe(0o600);
		expect(stdout).not.toContain(deviceCode);
		expect(stdout).not.toContain(credential.accessToken);
	} finally {
		if (running) {
			cli.kill("SIGTERM");
			try {
				await within(exit, 2_000, "CLI did not stop after SIGTERM.");
			} catch {
				cli.kill("SIGKILL");
				await within(exit, 2_000, "CLI did not stop after SIGKILL.");
			}
		} else {
			await exit;
		}
		await rm(workingDirectory, { force: true, recursive: true });
	}
});

test("Auth route matrix keeps every Project and Artifact page private", async ({
	page,
	request,
}) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "See the plan. Understand the work." }),
	).toBeVisible();

	await page.goto("/projects");
	const signInURL = new URL(page.url());
	expect(signInURL.pathname).toBe("/sign-in");
	expect(signInURL.searchParams.get("callbackURL")).toBe("/projects");
	expect(signInURL.searchParams.get("callbackURL")?.startsWith("/")).toBe(true);

	const anonymousApiResponse = await request.get("/api/projects/");
	expect(anonymousApiResponse.status()).toBe(401);
	expect(anonymousApiResponse.headers()["www-authenticate"]).toBe("Bearer");

	const unique = crypto.randomUUID();
	const projectResponse = await request.post("/api/projects/", {
		data: {
			idempotencyKey: `e2e_private_project_${unique}`,
			name: "Private E2E Project",
		},
		headers: authorizationHeaders,
	});
	expect(projectResponse.status()).toBe(201);
	const project = (await projectResponse.json()) as { readonly id: string };

	try {
		const artifactResponse = await request.post(
			`/api/projects/${project.id}/artifacts`,
			{
				data: {
					idempotencyKey: `e2e_private_artifact_${unique}`,
					source:
						"---\ntitle: Private E2E Artifact\ndescription: Private route coverage\n---\n\n## Private\n\nThis Artifact requires its owner.",
					sourceFormatVersion: 1,
				},
				headers: authorizationHeaders,
			},
		);
		expect(artifactResponse.status()).toBe(201);
		const artifact = (await artifactResponse.json()) as {
			readonly artifactId: string;
		};

		await page.goto(`/artifacts/${artifact.artifactId}`);
		const artifactSignInURL = new URL(page.url());
		expect(artifactSignInURL.pathname).toBe("/sign-in");
		expect(artifactSignInURL.searchParams.get("callbackURL")).toBe(
			`/artifacts/${artifact.artifactId}`,
		);

		await page.goto(`/artifacts/${artifact.artifactId}/revisions/1`);
		const revisionSignInURL = new URL(page.url());
		expect(revisionSignInURL.pathname).toBe("/sign-in");
		expect(revisionSignInURL.searchParams.get("callbackURL")).toBe(
			`/artifacts/${artifact.artifactId}/revisions/1`,
		);

		await page.setExtraHTTPHeaders(authorizationHeaders);
		await page.goto(`/artifacts/${artifact.artifactId}`);
		await expect(
			page.getByRole("heading", { name: "Private E2E Artifact" }),
		).toBeVisible();
		await expect(
			page.getByText("This Artifact requires its owner."),
		).toBeVisible();
	} finally {
		const cleanupResponse = await request.delete(
			`/api/projects/${project.id}`,
			{ headers: authorizationHeaders },
		);
		expect(cleanupResponse.status()).toBe(204);
	}
});

test("Project index opens the latest Artifact and a historical Revision", async ({
	page,
	request,
}) => {
	await page.setExtraHTTPHeaders(authorizationHeaders);
	const unique = crypto.randomUUID();
	const projectResponse = await request.post("/api/projects/", {
		data: { idempotencyKey: `e2e_project_${unique}`, name: "E2E Project" },
		headers: authorizationHeaders,
	});
	expect(projectResponse.status()).toBe(201);
	const project = (await projectResponse.json()) as { readonly id: string };

	try {
		const firstResponse = await request.post(
			`/api/projects/${project.id}/artifacts`,
			{
				data: {
					idempotencyKey: `e2e_first_${unique}`,
					source:
						"---\ntitle: Visual plan v1\ndescription: Initial plan\n---\n\n## Architecture\n\nFirst pass.",
					sourceFormatVersion: 1,
				},
				headers: authorizationHeaders,
			},
		);
		expect(firstResponse.status()).toBe(201);
		const first = (await firstResponse.json()) as {
			readonly artifactId: string;
			readonly revisionId: string;
		};

		const secondResponse = await request.post(
			`/api/artifacts/${first.artifactId}/revisions`,
			{
				data: {
					expectedCurrentRevisionId: first.revisionId,
					idempotencyKey: `e2e_second_${unique}`,
					source:
						'---\ntitle: Visual plan v2\ndescription: Current plan\n---\n\n## Architecture\n\n<Callout title="Ready" type="success">Second pass.</Callout>\n\n<Mermaid chart={`flowchart LR; Plan-->Build;`} />',
					sourceFormatVersion: 1,
				},
				headers: authorizationHeaders,
			},
		);
		expect(secondResponse.status()).toBe(201);

		await page.goto(`/projects/${project.id}`);
		await expect(
			page.getByRole("heading", { name: "E2E Project" }),
		).toBeVisible();
		await page.getByRole("link", { name: "Visual plan v2" }).click();
		await expect(
			page.getByRole("heading", { name: "Visual plan v2" }),
		).toBeVisible();
		await expect(page).toHaveTitle("Visual plan v2 · Artiflow");
		await expect(page.getByText("Revision 2").first()).toBeVisible();
		await expect(page.locator("[data-mermaid] svg.flowchart")).toBeVisible();

		await page.locator("summary").click();
		await page
			.locator("details")
			.getByRole("link", { name: "Revision 1" })
			.click();
		await expect(
			page.getByRole("heading", { name: "Visual plan v1" }),
		).toBeVisible();
		await expect(page).toHaveTitle("Visual plan v1 · Artiflow");
		await expect(page.getByText("First pass.")).toBeVisible();

		await page.setViewportSize({ height: 844, width: 390 });
		const viewport = await page.locator("html").evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}));
		expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
	} finally {
		const cleanupResponse = await request.delete(
			`/api/projects/${project.id}`,
			{
				headers: authorizationHeaders,
			},
		);
		expect(cleanupResponse.status()).toBe(204);
	}
});

test("Empty Projects recover after an Artifact is deleted", async ({
	page,
	request,
}) => {
	await page.setExtraHTTPHeaders(authorizationHeaders);
	const unique = crypto.randomUUID();
	const projectResponse = await request.post("/api/projects/", {
		data: { idempotencyKey: `e2e_empty_${unique}`, name: "Empty E2E Project" },
		headers: authorizationHeaders,
	});
	expect(projectResponse.status()).toBe(201);
	const project = (await projectResponse.json()) as { readonly id: string };

	try {
		await page.goto(`/projects/${project.id}`);
		await expect(
			page.getByRole("heading", { name: "Publish your first visual Artifact" }),
		).toBeVisible();

		const invalidPublicationResponse = await request.post(
			`/api/projects/${project.id}/artifacts`,
			{
				data: {
					idempotencyKey: `e2e_invalid_${unique}`,
					source: "## Missing title\n\nThis source is invalid.",
					sourceFormatVersion: 1,
				},
				headers: authorizationHeaders,
			},
		);
		expect(invalidPublicationResponse.status()).toBe(422);
		expect(await invalidPublicationResponse.json()).toMatchObject({
			_tag: "InvalidArtifactSource",
			diagnostics: [
				expect.objectContaining({
					code: "missing_title",
				}),
			],
		});

		const publicationResponse = await request.post(
			`/api/projects/${project.id}/artifacts`,
			{
				data: {
					idempotencyKey: `e2e_delete_${unique}`,
					source:
						"---\ntitle: Temporary Artifact\ndescription: Deletion coverage\n---\n\n## Temporary\n\nThis will be deleted.",
					sourceFormatVersion: 1,
				},
				headers: authorizationHeaders,
			},
		);
		expect(publicationResponse.status()).toBe(201);
		const publication = (await publicationResponse.json()) as {
			readonly artifactId: string;
		};

		await page.goto(`/artifacts/${publication.artifactId}`);
		await expect(
			page.getByRole("heading", { name: "Temporary Artifact" }),
		).toBeVisible();

		const deletionResponse = await request.delete(
			`/api/artifacts/${publication.artifactId}`,
			{ headers: authorizationHeaders },
		);
		expect(deletionResponse.status()).toBe(204);

		await page.goto(`/artifacts/${publication.artifactId}`);
		await expect(
			page.getByRole("heading", {
				name: "This Artiflow page isn’t available",
			}),
		).toBeVisible();
		await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();

		await page.goto(`/projects/${project.id}`);
		await expect(
			page.getByRole("heading", { name: "Publish your first visual Artifact" }),
		).toBeVisible();
	} finally {
		const cleanupResponse = await request.delete(
			`/api/projects/${project.id}`,
			{
				headers: authorizationHeaders,
			},
		);
		expect(cleanupResponse.status()).toBe(204);
	}
});

test("CLI publication opens as a browser Artifact", async ({
	page,
	request,
}) => {
	const workingDirectory = await mkdtemp(join(tmpdir(), "artiflow-e2e-cli-"));
	let projectId: string | undefined;

	try {
		const credentialsPath = await writeCliCredential(workingDirectory);
		const project = runCli(
			["project", "create", "CLI Browser E2E", "--json"],
			workingDirectory,
			credentialsPath,
		);
		projectId = String(project.id);
		await writeFile(
			join(workingDirectory, "browser-report.mdx"),
			"---\ntitle: Published through the CLI\ndescription: End-to-end CLI coverage\n---\n\n## Result\n\nThe browser received this Artifact from the real CLI.",
		);

		const publication = runCli(
			["publish", "browser-report.mdx", "--json"],
			workingDirectory,
			credentialsPath,
		);
		const artifactId = String(publication.artifactId);

		await page.setExtraHTTPHeaders(authorizationHeaders);
		await page.goto(`/artifacts/${artifactId}`);
		await expect(
			page.getByRole("heading", { name: "Published through the CLI" }),
		).toBeVisible();
		await expect(
			page.getByText("The browser received this Artifact"),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "CLI Browser E2E" }),
		).toBeVisible();
	} finally {
		if (projectId !== undefined) {
			const cleanupResponse = await request.delete(
				`/api/projects/${projectId}`,
				{ headers: authorizationHeaders },
			);
			expect(cleanupResponse.status()).toBe(204);
		}
		await rm(workingDirectory, { force: true, recursive: true });
	}
});
