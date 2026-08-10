import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { ArtifactService } from "./artifact-service";
import { ArtiflowRepository } from "./repository";
import { ProjectService } from "./project-service";

const ownerA = "user_artifact_a";
const ownerB = "user_artifact_b";

const run = <A, E>(
	effect: Effect.Effect<
		A,
		E,
		ArtifactService | ArtiflowRepository | ProjectService
	>,
) =>
	effect.pipe(
		Effect.provide(ArtifactService.Default),
		Effect.provide(ProjectService.Default),
		Effect.provide(ArtiflowRepository.testLayer()),
	);

const source = (title: string, body = "# Overview\n\nA clear visual report.") =>
	`---\ntitle: ${title}\ndescription: A visual report\n---\n\n${body}`;

describe("ArtifactService", () => {
	it.effect("validates and publishes Revision 1 idempotently", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			const project = yield* projects.create(ownerA, {
				idempotencyKey: "project_1",
				name: "Artiflow",
			});
			const request = {
				idempotencyKey: "publication_1",
				source: source("Implementation plan"),
				sourceFormatVersion: 1 as const,
			};

			const first = yield* artifacts.create(ownerA, project.id, request);
			const replay = yield* artifacts.create(ownerA, project.id, request);
			const artifact = yield* artifacts.get(ownerA, first.artifactId);

			assert.strictEqual(replay.revisionId, first.revisionId);
			assert.strictEqual(artifact.title, "Implementation plan");
			assert.strictEqual(artifact.revisionCount, 1);
			assert.strictEqual(artifact.revisions[0]?.number, 1);
			assert.notProperty(artifact, "source");
		}).pipe(run),
	);

	it.effect("returns structured diagnostics for invalid source", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			const project = yield* projects.create(ownerA, {
				idempotencyKey: "project_2",
				name: "Artiflow",
			});
			const error = yield* Effect.flip(
				artifacts.create(ownerA, project.id, {
					idempotencyKey: "publication_2",
					source: "# Missing frontmatter",
					sourceFormatVersion: 1,
				}),
			);

			assert.strictEqual(error._tag, "InvalidArtifactSource");
			if (error._tag === "InvalidArtifactSource") {
				assert.strictEqual(error.diagnostics[0]?.code, "missing_title");
			}
		}).pipe(run),
	);

	it.effect("rejects unsupported Source Formats as a declared failure", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			const project = yield* projects.create(ownerA, {
				idempotencyKey: "project_unsupported",
				name: "Artiflow",
			});
			const error = yield* Effect.flip(
				artifacts.create(ownerA, project.id, {
					idempotencyKey: "publication_unsupported",
					source: source("Future format"),
					sourceFormatVersion: 2,
				}),
			);

			assert.strictEqual(error._tag, "UnsupportedSourceFormat");
		}).pipe(run),
	);

	it.effect("appends only against the expected current Revision", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			const project = yield* projects.create(ownerA, {
				idempotencyKey: "project_3",
				name: "Artiflow",
			});
			const first = yield* artifacts.create(ownerA, project.id, {
				idempotencyKey: "publication_3",
				source: source("Plan v1"),
				sourceFormatVersion: 1,
			});
			const request = {
				expectedCurrentRevisionId: first.revisionId,
				idempotencyKey: "publication_4",
				source: source(
					"Plan v2",
					'# Updated\n\n<Callout title="Done">Shipped</Callout>',
				),
				sourceFormatVersion: 1 as const,
			};

			const second = yield* artifacts.appendRevision(
				ownerA,
				first.artifactId,
				request,
			);
			const replay = yield* artifacts.appendRevision(
				ownerA,
				first.artifactId,
				request,
			);
			const changedReplay = yield* Effect.flip(
				artifacts.appendRevision(ownerA, first.artifactId, {
					...request,
					expectedCurrentRevisionId: "rev_changed_expectation",
				}),
			);
			const conflict = yield* Effect.flip(
				artifacts.appendRevision(ownerA, first.artifactId, {
					...request,
					idempotencyKey: "publication_5",
				}),
			);
			const artifact = yield* artifacts.get(ownerA, first.artifactId);

			assert.strictEqual(second.revisionNumber, 2);
			assert.strictEqual(replay.revisionId, second.revisionId);
			assert.strictEqual(changedReplay._tag, "IdempotencyConflict");
			assert.strictEqual(conflict._tag, "ArtifactRevisionConflict");
			assert.strictEqual(artifact.title, "Plan v2");
			assert.deepStrictEqual(
				artifact.revisions.map((revision) => revision.number),
				[2, 1],
			);
		}).pipe(run),
	);

	it.effect("isolates management operations while retaining public reads", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			const projectA = yield* projects.create(ownerA, {
				idempotencyKey: "private_project",
				name: "Private project",
			});
			const projectB = yield* projects.create(ownerB, {
				idempotencyKey: "private_project",
				name: "Other private project",
			});
			const request = {
				idempotencyKey: "shared_publication_key",
				source: source("Private artifact"),
				sourceFormatVersion: 1 as const,
			};
			const publicationA = yield* artifacts.create(
				ownerA,
				projectA.id,
				request,
			);
			const publicationB = yield* artifacts.create(
				ownerB,
				projectB.id,
				request,
			);

			assert.notStrictEqual(publicationA.artifactId, publicationB.artifactId);
			assert.strictEqual(
				(yield* artifacts.getPublic(publicationA.artifactId)).id,
				publicationA.artifactId,
			);
			assert.strictEqual(
				(yield* artifacts.getPublicRevision(publicationA.artifactId)).number,
				1,
			);

			const wrongOwnerArtifact = yield* Effect.flip(
				artifacts.get(ownerB, publicationA.artifactId),
			);
			assert.strictEqual(wrongOwnerArtifact._tag, "ArtifactNotFound");
			const wrongOwnerRevision = yield* Effect.flip(
				artifacts.getRevision(ownerB, publicationA.artifactId),
			);
			assert.strictEqual(wrongOwnerRevision._tag, "ArtifactNotFound");

			const wrongOwnerList = yield* Effect.flip(
				artifacts.list(ownerB, projectA.id),
			);
			assert.strictEqual(wrongOwnerList._tag, "ProjectNotFound");
			const wrongOwnerCreate = yield* Effect.flip(
				artifacts.create(ownerB, projectA.id, {
					...request,
					idempotencyKey: "wrong_owner_create",
				}),
			);
			assert.strictEqual(wrongOwnerCreate._tag, "ProjectNotFound");

			const wrongOwnerAppend = yield* Effect.flip(
				artifacts.appendRevision(ownerB, publicationA.artifactId, {
					expectedCurrentRevisionId: publicationA.revisionId,
					idempotencyKey: "wrong_owner_append",
					source: source("Stolen revision"),
					sourceFormatVersion: 1,
				}),
			);
			assert.strictEqual(wrongOwnerAppend._tag, "ArtifactNotFound");
			const wrongOwnerDelete = yield* Effect.flip(
				artifacts.delete(ownerB, publicationA.artifactId),
			);
			assert.strictEqual(wrongOwnerDelete._tag, "ArtifactNotFound");
			assert.strictEqual(
				(yield* artifacts.get(ownerA, publicationA.artifactId)).id,
				publicationA.artifactId,
			);
		}).pipe(run),
	);
});
