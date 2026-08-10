import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { ArtiflowRepository } from "./repository";
import { ProjectService } from "./project-service";

const ownerA = "user_project_a";
const ownerB = "user_project_b";

const run = <A, E>(
	effect: Effect.Effect<A, E, ProjectService | ArtiflowRepository>,
) =>
	effect.pipe(
		Effect.provide(ProjectService.Default),
		Effect.provide(ArtiflowRepository.testLayer()),
	);

describe("ProjectService", () => {
	it.effect(
		"creates a Project idempotently and rejects a changed request",
		() =>
			Effect.gen(function* () {
				const projects = yield* ProjectService;
				const request = { idempotencyKey: "idem_project_1", name: "Artiflow" };

				const first = yield* projects.create(ownerA, request);
				const replay = yield* projects.create(ownerA, request);
				const conflict = yield* Effect.flip(
					projects.create(ownerA, {
						...request,
						name: "Different project",
					}),
				);
				const otherOwner = yield* projects.create(ownerB, request);

				assert.strictEqual(first.id, replay.id);
				assert.notStrictEqual(first.id, otherOwner.id);
				assert.strictEqual(first.name, "Artiflow");
				assert.strictEqual(conflict._tag, "IdempotencyConflict");
			}).pipe(run),
	);

	it.effect(
		"normalizes display names and supports rename and permanent deletion",
		() =>
			Effect.gen(function* () {
				const projects = yield* ProjectService;
				const project = yield* projects.create(ownerA, {
					idempotencyKey: "idem_project_2",
					name: "  Product   redesign  ",
				});

				assert.strictEqual(project.name, "Product redesign");

				const renamed = yield* projects.rename(
					ownerA,
					project.id,
					"  Agent reports ",
				);
				assert.strictEqual(renamed.name, "Agent reports");

				yield* projects.delete(ownerA, project.id);
				const missing = yield* Effect.flip(projects.get(ownerA, project.id));
				assert.strictEqual(missing._tag, "ProjectNotFound");
			}).pipe(run),
	);

	it.effect("rejects blank names", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const error = yield* Effect.flip(
				projects.create(ownerA, {
					idempotencyKey: "idem_project_3",
					name: "   ",
				}),
			);

			assert.strictEqual(error._tag, "InvalidProjectName");
		}).pipe(run),
	);

	it.effect("lists Projects with their Artifact counts", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const first = yield* projects.create(ownerA, {
				idempotencyKey: "idem_project_list_1",
				name: "First project",
			});
			const second = yield* projects.create(ownerA, {
				idempotencyKey: "idem_project_list_2",
				name: "Second project",
			});

			yield* projects.create(ownerB, {
				idempotencyKey: "idem_project_list_other",
				name: "Other owner's project",
			});

			const listed = yield* projects.list(ownerA);
			const ids = listed.map((item) => item.project.id);

			assert.include(ids, first.id);
			assert.include(ids, second.id);
			assert.isTrue(listed.every((item) => item.artifactCount === 0));
		}).pipe(run),
	);

	it.effect("treats another owner's Project as not found", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const project = yield* projects.create(ownerA, {
				idempotencyKey: "idem_project_private",
				name: "Private project",
			});

			for (const operation of [
				projects.get(ownerB, project.id),
				projects.rename(ownerB, project.id, "Stolen"),
				projects.delete(ownerB, project.id),
			]) {
				const failure = yield* Effect.flip(operation);
				assert.strictEqual(failure._tag, "ProjectNotFound");
			}

			assert.strictEqual(
				(yield* projects.get(ownerA, project.id)).name,
				"Private project",
			);
			assert.strictEqual(
				(yield* projects.getPublic(project.id)).id,
				project.id,
			);
		}).pipe(run),
	);
});
