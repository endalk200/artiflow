import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Pool } from "pg";

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
			const ownerA = `user_database_a_${unique}`;
			const ownerB = `user_database_b_${unique}`;
			const seedOwners = Effect.tryPromise(async () => {
				const pool = new Pool({ connectionString: databaseUrl });
				try {
					for (const [id, name] of [
						[ownerA, "Database owner A"],
						[ownerB, "Database owner B"],
					] as const) {
						await pool.query(
							'insert into "user" (id, name, email, email_verified, created_at, updated_at) values ($1, $2, $3, false, now(), now())',
							[id, name, `${id}@example.com`],
						);
					}
				} finally {
					await pool.end();
				}
			});
			const deleteOwners = Effect.promise(async () => {
				const pool = new Pool({ connectionString: databaseUrl });
				try {
					await pool.query('delete from "user" where id = any($1)', [
						[ownerA, ownerB],
					]);
				} finally {
					await pool.end();
				}
			});

			return Effect.gen(function* () {
				yield* seedOwners;
				const projects = yield* ProjectService;
				const artifacts = yield* ArtifactService;
				const concurrentProjectRequest = {
					idempotencyKey: `project_concurrent_${unique}`,
					name: "Concurrent database tracer",
				};
				const [concurrentProjectA, concurrentProjectB] = yield* Effect.all(
					[
						projects.create(ownerA, concurrentProjectRequest),
						projects.create(ownerA, concurrentProjectRequest),
					],
					{ concurrency: "unbounded" },
				);
				assert.strictEqual(concurrentProjectA.id, concurrentProjectB.id);
				const projectRequest = {
					idempotencyKey: `project_${unique}`,
					name: "Database tracer",
				};
				const project = yield* projects.create(ownerA, projectRequest);
				const replayedProject = yield* projects.create(ownerA, projectRequest);
				const otherOwnerProject = yield* projects.create(
					ownerB,
					projectRequest,
				);
				assert.strictEqual(replayedProject.id, project.id);
				assert.notStrictEqual(otherOwnerProject.id, project.id);
				const concurrentPublicationRequest = {
					idempotencyKey: `revision_concurrent_${unique}`,
					source: "---\ntitle: Concurrent publication\n---\n\n# First",
					sourceFormatVersion: 1 as const,
				};
				const [concurrentPublicationA, concurrentPublicationB] =
					yield* Effect.all(
						[
							artifacts.create(
								ownerA,
								project.id,
								concurrentPublicationRequest,
							),
							artifacts.create(
								ownerA,
								project.id,
								concurrentPublicationRequest,
							),
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
				const first = yield* artifacts.create(ownerA, project.id, firstRequest);
				const replayedFirst = yield* artifacts.create(
					ownerA,
					project.id,
					firstRequest,
				);
				const otherOwnerFirst = yield* artifacts.create(
					ownerB,
					otherOwnerProject.id,
					firstRequest,
				);
				assert.strictEqual(replayedFirst.revisionId, first.revisionId);
				assert.notStrictEqual(otherOwnerFirst.artifactId, first.artifactId);

				const idempotencyConflict = yield* Effect.flip(
					artifacts.create(ownerA, project.id, {
						...firstRequest,
						source: "---\ntitle: Changed\n---\n",
					}),
				);
				assert.strictEqual(idempotencyConflict._tag, "IdempotencyConflict");

				const second = yield* artifacts.appendRevision(
					ownerA,
					first.artifactId,
					{
						expectedCurrentRevisionId: first.revisionId,
						idempotencyKey: `revision_2_${unique}`,
						source: "---\ntitle: Database v2\n---\n\n# Second",
						sourceFormatVersion: 1,
					},
				);
				assert.strictEqual(second.revisionNumber, 2);

				const revisionConflict = yield* Effect.flip(
					artifacts.appendRevision(ownerA, first.artifactId, {
						expectedCurrentRevisionId: first.revisionId,
						idempotencyKey: `revision_3_${unique}`,
						source: "---\ntitle: Stale\n---\n",
						sourceFormatVersion: 1,
					}),
				);
				assert.strictEqual(revisionConflict._tag, "ArtifactRevisionConflict");

				const artifact = yield* artifacts.get(ownerA, first.artifactId);
				assert.deepStrictEqual(
					artifact.revisions.map((revision) => revision.number),
					[2, 1],
				);

				const hiddenProject = yield* Effect.flip(
					projects.get(ownerB, project.id),
				);
				assert.strictEqual(hiddenProject._tag, "ProjectNotFound");
				const hiddenArtifact = yield* Effect.flip(
					artifacts.get(ownerB, first.artifactId),
				);
				assert.strictEqual(hiddenArtifact._tag, "ArtifactNotFound");

				yield* projects.delete(ownerA, project.id);
				const deleted = yield* Effect.flip(
					artifacts.get(ownerA, first.artifactId),
				);
				assert.strictEqual(deleted._tag, "ArtifactNotFound");
			}).pipe(Effect.ensuring(deleteOwners), Effect.provide(ServicesLive));
		},
	);
});
