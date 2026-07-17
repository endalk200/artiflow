import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { ArtiflowRepository } from "./repository";
import { ProjectService } from "./project-service";

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

				const first = yield* projects.create(request);
				const replay = yield* projects.create(request);
				const conflict = yield* Effect.flip(
					projects.create({ ...request, name: "Different project" }),
				);

				assert.strictEqual(first.id, replay.id);
				assert.strictEqual(first.name, "Artiflow");
				assert.strictEqual(conflict._tag, "IdempotencyConflict");
			}).pipe(run),
	);

	it.effect(
		"normalizes display names and supports rename and permanent deletion",
		() =>
			Effect.gen(function* () {
				const projects = yield* ProjectService;
				const project = yield* projects.create({
					idempotencyKey: "idem_project_2",
					name: "  Product   redesign  ",
				});

				assert.strictEqual(project.name, "Product redesign");

				const renamed = yield* projects.rename(project.id, "  Agent reports ");
				assert.strictEqual(renamed.name, "Agent reports");

				yield* projects.delete(project.id);
				const missing = yield* Effect.flip(projects.get(project.id));
				assert.strictEqual(missing._tag, "ProjectNotFound");
			}).pipe(run),
	);

	it.effect("rejects blank names", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const error = yield* Effect.flip(
				projects.create({ idempotencyKey: "idem_project_3", name: "   " }),
			);

			assert.strictEqual(error._tag, "InvalidProjectName");
		}).pipe(run),
	);

	it.effect("lists Projects with their Artifact counts", () =>
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const first = yield* projects.create({
				idempotencyKey: "idem_project_list_1",
				name: "First project",
			});
			const second = yield* projects.create({
				idempotencyKey: "idem_project_list_2",
				name: "Second project",
			});

			const listed = yield* projects.list();
			const ids = listed.map((item) => item.project.id);

			assert.include(ids, first.id);
			assert.include(ids, second.id);
			assert.isTrue(listed.every((item) => item.artifactCount === 0));
		}).pipe(run),
	);
});
