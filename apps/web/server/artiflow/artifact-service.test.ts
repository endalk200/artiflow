import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { ArtifactService } from "./artifact-service";
import { ArtiflowRepository } from "./repository";
import { ProjectService } from "./project-service";

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
			const project = yield* projects.create({
				idempotencyKey: "project_1",
				name: "Artiflow",
			});
			const request = {
				idempotencyKey: "publication_1",
				source: source("Implementation plan"),
				sourceFormatVersion: 1 as const,
			};

			const first = yield* artifacts.create(project.id, request);
			const replay = yield* artifacts.create(project.id, request);
			const artifact = yield* artifacts.get(first.artifactId);

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
			const project = yield* projects.create({
				idempotencyKey: "project_2",
				name: "Artiflow",
			});
			const error = yield* Effect.flip(
				artifacts.create(project.id, {
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
			const project = yield* projects.create({
				idempotencyKey: "project_unsupported",
				name: "Artiflow",
			});
			const error = yield* Effect.flip(
				artifacts.create(project.id, {
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
			const project = yield* projects.create({
				idempotencyKey: "project_3",
				name: "Artiflow",
			});
			const first = yield* artifacts.create(project.id, {
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

			const second = yield* artifacts.appendRevision(first.artifactId, request);
			const replay = yield* artifacts.appendRevision(first.artifactId, request);
			const changedReplay = yield* Effect.flip(
				artifacts.appendRevision(first.artifactId, {
					...request,
					expectedCurrentRevisionId: "rev_changed_expectation",
				}),
			);
			const conflict = yield* Effect.flip(
				artifacts.appendRevision(first.artifactId, {
					...request,
					idempotencyKey: "publication_5",
				}),
			);
			const artifact = yield* artifacts.get(first.artifactId);

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
});
