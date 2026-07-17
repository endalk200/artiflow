import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { e2eBaseUrl } from "./config";

const cliEntrypoint = fileURLToPath(
	new URL("../../cli/src/bin.ts", import.meta.url),
);

const runCli = (args: ReadonlyArray<string>, cwd: string) => {
	const result = spawnSync("bun", [cliEntrypoint, ...args], {
		cwd,
		encoding: "utf8",
		env: {
			...process.env,
			ARTIFLOW_BASE_URL: e2eBaseUrl,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
	return JSON.parse(result.stdout) as Record<string, unknown>;
};

test("Project index opens the latest Artifact and a historical Revision", async ({
	page,
	request,
}) => {
	const unique = crypto.randomUUID();
	const projectResponse = await request.post("/api/projects/", {
		data: { idempotencyKey: `e2e_project_${unique}`, name: "E2E Project" },
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
		await expect(page.getByText("First pass.")).toBeVisible();

		await page.setViewportSize({ height: 844, width: 390 });
		const viewport = await page.locator("html").evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}));
		expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
	} finally {
		const cleanupResponse = await request.delete(`/api/projects/${project.id}`);
		expect(cleanupResponse.status()).toBe(204);
	}
});

test("Empty Projects recover after an Artifact is deleted", async ({
	page,
	request,
}) => {
	const unique = crypto.randomUUID();
	const projectResponse = await request.post("/api/projects/", {
		data: { idempotencyKey: `e2e_empty_${unique}`, name: "Empty E2E Project" },
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
		const cleanupResponse = await request.delete(`/api/projects/${project.id}`);
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
		const project = runCli(
			["project", "create", "CLI Browser E2E", "--json"],
			workingDirectory,
		);
		projectId = String(project.id);
		await writeFile(
			join(workingDirectory, "browser-report.mdx"),
			"---\ntitle: Published through the CLI\ndescription: End-to-end CLI coverage\n---\n\n## Result\n\nThe browser received this Artifact from the real CLI.",
		);

		const publication = runCli(
			["publish", "browser-report.mdx", "--json"],
			workingDirectory,
		);
		const artifactId = String(publication.artifactId);

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
			);
			expect(cleanupResponse.status()).toBe(204);
		}
		await rm(workingDirectory, { force: true, recursive: true });
	}
});
