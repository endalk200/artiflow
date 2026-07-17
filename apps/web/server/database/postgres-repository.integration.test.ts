import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { ArtifactService } from "../artiflow/artifact-service";
import { ProjectService } from "../artiflow/project-service";
import { postgresRepositoryLayer } from "./postgres-repository";

const databaseUrl = process.env.DATABASE_TEST_URL;
if (databaseUrl === undefined) {
	throw new Error(
		"DATABASE_TEST_URL is required for the PostgreSQL integration test project.",
	);
}

describe("PostgreSQL Artiflow repository", () => {
	it.effect(
		"preserves idempotency, revision ordering, concurrency, and cascading deletion",
		() => {
			const RepositoryLive = postgresRepositoryLayer(databaseUrl);
			const ServicesLive = Layer.mergeAll(
				ProjectService.Default,
				ArtifactService.Default,
			).pipe(Layer.provide(RepositoryLive));
			const unique = crypto.randomUUID();

			return Effect.gen(function* () {
				const projects = yield* ProjectService;
				const artifacts = yield* ArtifactService;
				const concurrentProjectRequest = {
					idempotencyKey: `project_concurrent_${unique}`,
					name: "Concurrent database tracer",
				};
				const [concurrentProjectA, concurrentProjectB] = yield* Effect.all(
					[
						projects.create(concurrentProjectRequest),
						projects.create(concurrentProjectRequest),
					],
					{ concurrency: "unbounded" },
				);
				assert.strictEqual(concurrentProjectA.id, concurrentProjectB.id);
				const projectRequest = {
					idempotencyKey: `project_${unique}`,
					name: "Database tracer",
				};
				const project = yield* projects.create(projectRequest);
				const replayedProject = yield* projects.create(projectRequest);
				assert.strictEqual(replayedProject.id, project.id);
				const concurrentPublicationRequest = {
					idempotencyKey: `revision_concurrent_${unique}`,
					source: "---\ntitle: Concurrent publication\n---\n\n# First",
					sourceFormatVersion: 1 as const,
				};
				const [concurrentPublicationA, concurrentPublicationB] =
					yield* Effect.all(
						[
							artifacts.create(project.id, concurrentPublicationRequest),
							artifacts.create(project.id, concurrentPublicationRequest),
						],
						{ concurrency: "unbounded" },
					);
				assert.strictEqual(
					concurrentPublicationA.revisionId,
					concurrentPublicationB.revisionId,
				);

				const firstRequest = {
					idempotencyKey: `revision_1_${unique}`,
					source: "---\ntitle: Database v1\n---\n\n# First",
					sourceFormatVersion: 1 as const,
				};
				const first = yield* artifacts.create(project.id, firstRequest);
				const replayedFirst = yield* artifacts.create(project.id, firstRequest);
				assert.strictEqual(replayedFirst.revisionId, first.revisionId);

				const idempotencyConflict = yield* Effect.flip(
					artifacts.create(project.id, {
						...firstRequest,
						source: "---\ntitle: Changed\n---\n",
					}),
				);
				assert.strictEqual(idempotencyConflict._tag, "IdempotencyConflict");

				const second = yield* artifacts.appendRevision(first.artifactId, {
					expectedCurrentRevisionId: first.revisionId,
					idempotencyKey: `revision_2_${unique}`,
					source: "---\ntitle: Database v2\n---\n\n# Second",
					sourceFormatVersion: 1,
				});
				assert.strictEqual(second.revisionNumber, 2);

				const revisionConflict = yield* Effect.flip(
					artifacts.appendRevision(first.artifactId, {
						expectedCurrentRevisionId: first.revisionId,
						idempotencyKey: `revision_3_${unique}`,
						source: "---\ntitle: Stale\n---\n",
						sourceFormatVersion: 1,
					}),
				);
				assert.strictEqual(revisionConflict._tag, "ArtifactRevisionConflict");

				const artifact = yield* artifacts.get(first.artifactId);
				assert.deepStrictEqual(
					artifact.revisions.map((revision) => revision.number),
					[2, 1],
				);

				yield* projects.delete(project.id);
				const deleted = yield* Effect.flip(artifacts.get(first.artifactId));
				assert.strictEqual(deleted._tag, "ArtifactNotFound");
			}).pipe(Effect.provide(ServicesLive));
		},
	);
});
