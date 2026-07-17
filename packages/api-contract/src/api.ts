import {
	HttpApi,
	HttpApiEndpoint,
	HttpApiGroup,
	HttpApiMiddleware,
	HttpApiSchema,
} from "effect/unstable/httpapi";

import {
	AppendRevisionPayload,
	Artifact,
	ArtifactList,
	ArtifactNotFound,
	ArtifactRevisionConflict,
	CreateProjectPayload,
	CreateArtifactPayload,
	IdempotencyConflict,
	InfrastructureError,
	InvalidArtifactSource,
	InvalidProjectName,
	InvalidRequest,
	Project,
	ProjectNotFound,
	PublishResult,
	RenameProjectPayload,
	UnsupportedSourceFormat,
} from "./models";

export class RequestSchemaErrorMiddleware extends HttpApiMiddleware.Service<RequestSchemaErrorMiddleware>()(
	"artiflow/RequestSchemaErrorMiddleware",
	{ error: InvalidRequest },
) {}

export class ProjectsApi extends HttpApiGroup.make("projects")
	.add(
		HttpApiEndpoint.post("create", "/", {
			error: [IdempotencyConflict, InfrastructureError, InvalidProjectName],
			payload: CreateProjectPayload,
			success: Project.pipe(HttpApiSchema.status("Created")),
		}),
		HttpApiEndpoint.get("get", "/:projectId", {
			error: [InfrastructureError, ProjectNotFound],
			params: { projectId: Project.fields.id },
			success: Project,
		}),
		HttpApiEndpoint.patch("rename", "/:projectId", {
			error: [InfrastructureError, InvalidProjectName, ProjectNotFound],
			params: { projectId: Project.fields.id },
			payload: RenameProjectPayload,
			success: Project,
		}),
		HttpApiEndpoint.delete("delete", "/:projectId", {
			error: [InfrastructureError, ProjectNotFound],
			params: { projectId: Project.fields.id },
		}),
		HttpApiEndpoint.get("listArtifacts", "/:projectId/artifacts", {
			error: [InfrastructureError, ProjectNotFound],
			params: { projectId: Project.fields.id },
			success: ArtifactList,
		}),
		HttpApiEndpoint.post("createArtifact", "/:projectId/artifacts", {
			error: [
				IdempotencyConflict,
				InfrastructureError,
				InvalidArtifactSource,
				ProjectNotFound,
				UnsupportedSourceFormat,
			],
			params: { projectId: Project.fields.id },
			payload: CreateArtifactPayload,
			success: PublishResult.pipe(HttpApiSchema.status("Created")),
		}),
	)
	.prefix("/api/projects") {}

export class ArtifactsApi extends HttpApiGroup.make("artifacts")
	.add(
		HttpApiEndpoint.get("get", "/:artifactId", {
			error: [ArtifactNotFound, InfrastructureError],
			params: { artifactId: Artifact.fields.id },
			success: Artifact,
		}),
		HttpApiEndpoint.delete("delete", "/:artifactId", {
			error: [ArtifactNotFound, InfrastructureError],
			params: { artifactId: Artifact.fields.id },
		}),
		HttpApiEndpoint.post("appendRevision", "/:artifactId/revisions", {
			error: [
				ArtifactNotFound,
				ArtifactRevisionConflict,
				IdempotencyConflict,
				InfrastructureError,
				InvalidArtifactSource,
				UnsupportedSourceFormat,
			],
			params: { artifactId: Artifact.fields.id },
			payload: AppendRevisionPayload,
			success: PublishResult.pipe(HttpApiSchema.status("Created")),
		}),
	)
	.prefix("/api/artifacts") {}

export class ArtiflowApi extends HttpApi.make("artiflow")
	.add(ProjectsApi)
	.add(ArtifactsApi)
	.middleware(RequestSchemaErrorMiddleware) {}
