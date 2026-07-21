import {
	type CreateProjectPayload,
	IdempotencyConflict,
	type InfrastructureError,
	InvalidProjectName,
	type Project,
	ProjectNotFound,
} from "@app/api-contract/models";
import { Context, Effect, Layer, Option } from "effect";

import {
	recordOperationInfo,
	recordOperationWarning,
} from "../telemetry/operation";
import { ArtiflowRepository, type ProjectListItem } from "./repository";

const normalizeProjectName = (name: string) => name.trim().replace(/\s+/g, " ");

const validateProjectName = (name: string) => {
	const normalized = normalizeProjectName(name);
	return normalized.length === 0 || normalized.length > 120
		? Effect.fail(
				new InvalidProjectName({
					message: "Project name must contain between 1 and 120 characters.",
				}),
			)
		: Effect.succeed(normalized);
};

const requestHash = (name: string) => `project-name:${name}`;

export type ProjectServiceShape = {
	readonly create: (
		payload: typeof CreateProjectPayload.Type,
	) => Effect.Effect<
		Project,
		IdempotencyConflict | InfrastructureError | InvalidProjectName
	>;
	readonly delete: (
		projectId: string,
	) => Effect.Effect<void, InfrastructureError | ProjectNotFound>;
	readonly get: (
		projectId: string,
	) => Effect.Effect<Project, InfrastructureError | ProjectNotFound>;
	readonly list: () => Effect.Effect<
		ReadonlyArray<ProjectListItem>,
		InfrastructureError
	>;
	readonly rename: (
		projectId: string,
		name: string,
	) => Effect.Effect<
		Project,
		InfrastructureError | InvalidProjectName | ProjectNotFound
	>;
};

export class ProjectService extends Context.Service<
	ProjectService,
	ProjectServiceShape
>()("ProjectService") {
	static readonly Default = Layer.effect(
		ProjectService,
		Effect.gen(function* () {
			const repository = yield* ArtiflowRepository;

			return ProjectService.of({
				create: (payload) =>
					Effect.gen(function* () {
						const name = yield* validateProjectName(payload.name);
						const result = yield* repository.createProject({
							id: `prj_${crypto.randomUUID()}`,
							idempotencyKey: payload.idempotencyKey,
							name,
							now: new Date().toISOString(),
							requestHash: requestHash(name),
						});

						if (result._tag === "conflict") {
							yield* recordOperationWarning(
								"Project creation idempotency conflict",
								{ "artiflow.operation.outcome": "conflict" },
							);
							return yield* new IdempotencyConflict({
								idempotencyKey: payload.idempotencyKey,
							});
						}

						yield* recordOperationInfo("Project persisted", {
							"artiflow.operation.outcome": result._tag,
							"artiflow.project.id": result.project.id,
						});
						return result.project;
					}).pipe(Effect.withSpan("artiflow.project.create")),
				delete: (projectId) =>
					Effect.gen(function* () {
						const deleted = yield* repository.deleteProject(projectId);
						if (!deleted) return yield* new ProjectNotFound({ projectId });

						yield* recordOperationInfo("Project deleted", {
							"artiflow.operation.outcome": "deleted",
							"artiflow.project.id": projectId,
						});
					}).pipe(
						Effect.withSpan("artiflow.project.delete", {
							attributes: { "artiflow.project.id": projectId },
						}),
					),
				get: (projectId) =>
					repository.getProject(projectId).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.fail(new ProjectNotFound({ projectId })),
								onSome: Effect.succeed,
							}),
						),
						Effect.withSpan("artiflow.project.get", {
							attributes: { "artiflow.project.id": projectId },
						}),
					),
				list: () =>
					repository
						.listProjects()
						.pipe(Effect.withSpan("artiflow.project.list")),
				rename: (projectId, requestedName) =>
					Effect.gen(function* () {
						const name = yield* validateProjectName(requestedName);
						const project = yield* repository.renameProject(
							projectId,
							name,
							new Date().toISOString(),
						);
						const renamed = yield* Option.match(project, {
							onNone: () => Effect.fail(new ProjectNotFound({ projectId })),
							onSome: Effect.succeed,
						});
						yield* recordOperationInfo("Project renamed", {
							"artiflow.operation.outcome": "renamed",
							"artiflow.project.id": projectId,
						});
						return renamed;
					}).pipe(
						Effect.withSpan("artiflow.project.rename", {
							attributes: { "artiflow.project.id": projectId },
						}),
					),
			});
		}),
	);
}
