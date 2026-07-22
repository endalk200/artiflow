import { assert, describe, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";

import { ArtiflowRepository } from "../artiflow/repository";
import { makeApiHandler, makeRecoveringWebHandler } from "./api-handler";

describe("Artiflow HTTP API", () => {
	it("publishes an Artifact through the assembled Fetch handler", async () => {
		const app = makeApiHandler(ArtiflowRepository.testLayer());
		try {
			const projectResponse = await app.handler(
				new Request("http://localhost/api/projects/", {
					body: JSON.stringify({
						idempotencyKey: "project_http",
						name: "HTTP tracer",
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
				Context.empty(),
			);
			assert.strictEqual(projectResponse.status, 201);
			const project = (await projectResponse.json()) as { readonly id: string };
			const unsupportedResponse = await app.handler(
				new Request(`http://localhost/api/projects/${project.id}/artifacts`, {
					body: JSON.stringify({
						idempotencyKey: "artifact_http_future",
						source: "---\ntitle: Future\n---\n",
						sourceFormatVersion: 2,
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
				Context.empty(),
			);
			assert.strictEqual(unsupportedResponse.status, 422);
			assert.deepInclude(await unsupportedResponse.json(), {
				_tag: "UnsupportedSourceFormat",
			});

			const publicationResponse = await app.handler(
				new Request(`http://localhost/api/projects/${project.id}/artifacts`, {
					body: JSON.stringify({
						idempotencyKey: "artifact_http",
						source: "---\ntitle: HTTP artifact\n---\n\n# It works",
						sourceFormatVersion: 1,
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
				Context.empty(),
			);
			const publicationBody = await publicationResponse.text();
			assert.strictEqual(publicationResponse.status, 201, publicationBody);
			const publication = JSON.parse(publicationBody) as {
				readonly artifactId: string;
				readonly revisionNumber: number;
			};
			assert.match(publication.artifactId, /^art_/);
			assert.strictEqual(publication.revisionNumber, 1);

			const artifactResponse = await app.handler(
				new Request(`http://localhost/api/artifacts/${publication.artifactId}`),
				Context.empty(),
			);
			assert.strictEqual(artifactResponse.status, 200);
			const artifact = (await artifactResponse.json()) as {
				readonly title: string;
			};
			assert.strictEqual(artifact.title, "HTTP artifact");
		} finally {
			await app.dispose();
		}
	});

	it("encodes declared validation errors", async () => {
		const app = makeApiHandler(ArtiflowRepository.testLayer());
		try {
			const response = await app.handler(
				new Request("http://localhost/api/projects/", {
					body: JSON.stringify({
						idempotencyKey: "invalid_project",
						name: " ",
					}),
					headers: { "content-type": "application/json" },
					method: "POST",
				}),
				Context.empty(),
			);
			assert.strictEqual(response.status, 422);
			assert.deepInclude(await response.json(), { _tag: "InvalidProjectName" });
		} finally {
			await app.dispose();
		}
	});

	it("encodes malformed request payloads as stable JSON errors", async () => {
		const app = makeApiHandler(ArtiflowRepository.testLayer());
		try {
			for (const body of [
				JSON.stringify({ name: "Missing idempotency key" }),
				"{",
			]) {
				const response = await app.handler(
					new Request("http://localhost/api/projects/", {
						body,
						headers: { "content-type": "application/json" },
						method: "POST",
					}),
					Context.empty(),
				);

				assert.strictEqual(response.status, 400);
				assert.include(
					response.headers.get("content-type") ?? "",
					"application/json",
				);
				assert.deepStrictEqual(await response.json(), {
					_tag: "InvalidRequest",
					location: "payload",
					message: "Request payload does not match the API contract.",
				});
			}
		} finally {
			await app.dispose();
		}
	});

	it("rebuilds the handler after its service layer fails to initialize", async () => {
		let initializationAttempts = 0;
		const repositoryLayer = Layer.unwrap(
			Effect.sync(() => {
				initializationAttempts += 1;
				return initializationAttempts === 1
					? Layer.effect(
							ArtiflowRepository,
							Effect.fail(new Error("Database connection timed out")),
						)
					: ArtiflowRepository.testLayer();
			}),
		);
		const app = makeApiHandler(repositoryLayer);
		const request = () =>
			new Request("http://localhost/api/projects/", {
				body: JSON.stringify({
					idempotencyKey: "project_after_recovery",
					name: "Recovered project",
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			});

		try {
			let initializationFailure: unknown;
			try {
				await app.handler(request(), Context.empty());
			} catch (cause) {
				initializationFailure = cause;
			}
			assert.strictEqual(
				initializationFailure instanceof Error
					? initializationFailure.message
					: undefined,
				"Database connection timed out",
			);

			const response = await app.handler(request(), Context.empty());

			assert.strictEqual(response.status, 201);
			assert.strictEqual(initializationAttempts, 2);
		} finally {
			await app.dispose();
		}
	});

	it("preserves initialization failure when disposing the failed handler also fails", async () => {
		const initializationFailure = new Error("Database connection timed out");
		const disposalFailure = new Error("Database pool cleanup failed");
		const reportingFailure = new Error("Cleanup error reporting failed");
		const reportedFailures: Array<unknown> = [];
		let generation = 0;
		const app = makeRecoveringWebHandler(
			() => {
				generation += 1;
				return generation === 1
					? {
							dispose: () => Promise.reject(disposalFailure),
							handler: () => Promise.reject(initializationFailure),
							isInitialized: () => false,
						}
					: {
							dispose: () => Promise.resolve(),
							handler: () =>
								Promise.resolve(new Response(null, { status: 204 })),
							isInitialized: () => true,
						};
			},
			(cause) => {
				reportedFailures.push(cause);
				throw reportingFailure;
			},
		);

		try {
			let receivedFailure: unknown;
			try {
				await app.handler(new Request("http://localhost/api/projects"));
			} catch (cause) {
				receivedFailure = cause;
			}

			assert.strictEqual(receivedFailure, initializationFailure);
			assert.deepStrictEqual(reportedFailures, [disposalFailure]);

			const response = await app.handler(
				new Request("http://localhost/api/projects"),
			);

			assert.strictEqual(response.status, 204);
			assert.strictEqual(generation, 2);
		} finally {
			await app.dispose();
		}
	});
});
