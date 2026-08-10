import { createHash } from "node:crypto";
import {
	type AppendRevisionPayload,
	type Artifact,
	ArtifactNotFound,
	ArtifactRevisionConflict,
	type ArtifactSummary,
	type CreateArtifactPayload,
	IdempotencyConflict,
	type InfrastructureError,
	type InvalidArtifactSource,
	ProjectNotFound,
	type PublishResult,
	RevisionNotFound,
	UnsupportedSourceFormat,
} from "@app/api-contract/models";
import { Context, Effect, Layer, Option } from "effect";

import {
	recordOperationInfo,
	recordOperationWarning,
} from "../telemetry/operation";
import { ArtiflowRepository, type StoredRevision } from "./repository";
import { validateArtifactSource } from "./source-validator";

const publicationHash = (request: {
	readonly expectedCurrentRevisionId?: string;
	readonly source: string;
	readonly sourceFormatVersion: number;
	readonly targetId: string;
}) =>
	createHash("sha256")
		.update(
			JSON.stringify([
				request.targetId,
				request.expectedCurrentRevisionId ?? null,
				request.sourceFormatVersion,
				request.source,
			]),
		)
		.digest("hex");

const publicBaseUrl = () =>
	(
		process.env.ARTIFLOW_PUBLIC_BASE_URL ??
		process.env.NEXT_PUBLIC_APP_URL ??
		"http://localhost:3000"
	).replace(/\/$/, "");

const toPublishResult = (publication: {
	readonly artifactId: string;
	readonly projectId: string;
	readonly revisionId: string;
	readonly revisionNumber: number;
}) =>
	({
		...publication,
		url: `${publicBaseUrl()}/artifacts/${publication.artifactId}`,
	}) satisfies typeof PublishResult.Type;

export type ArtifactServiceShape = {
	readonly appendRevision: (
		ownerUserId: string,
		artifactId: string,
		payload: typeof AppendRevisionPayload.Type,
	) => Effect.Effect<
		typeof PublishResult.Type,
		| ArtifactNotFound
		| ArtifactRevisionConflict
		| IdempotencyConflict
		| InfrastructureError
		| InvalidArtifactSource
		| UnsupportedSourceFormat
	>;
	readonly create: (
		ownerUserId: string,
		projectId: string,
		payload: typeof CreateArtifactPayload.Type,
	) => Effect.Effect<
		typeof PublishResult.Type,
		| IdempotencyConflict
		| InfrastructureError
		| InvalidArtifactSource
		| ProjectNotFound
		| UnsupportedSourceFormat
	>;
	readonly delete: (
		ownerUserId: string,
		artifactId: string,
	) => Effect.Effect<void, ArtifactNotFound | InfrastructureError>;
	readonly get: (
		ownerUserId: string,
		artifactId: string,
	) => Effect.Effect<Artifact, ArtifactNotFound | InfrastructureError>;
	readonly getPublic: (
		artifactId: string,
	) => Effect.Effect<Artifact, ArtifactNotFound | InfrastructureError>;
	readonly getRevision: (
		ownerUserId: string,
		artifactId: string,
		revisionNumber?: number,
	) => Effect.Effect<
		StoredRevision,
		ArtifactNotFound | InfrastructureError | RevisionNotFound
	>;
	readonly getPublicRevision: (
		artifactId: string,
		revisionNumber?: number,
	) => Effect.Effect<
		StoredRevision,
		ArtifactNotFound | InfrastructureError | RevisionNotFound
	>;
	readonly list: (
		ownerUserId: string,
		projectId: string,
	) => Effect.Effect<
		ReadonlyArray<ArtifactSummary>,
		InfrastructureError | ProjectNotFound
	>;
};

export class ArtifactService extends Context.Service<
	ArtifactService,
	ArtifactServiceShape
>()("ArtifactService") {
	static readonly Default = Layer.effect(
		ArtifactService,
		Effect.gen(function* () {
			const repository = yield* ArtiflowRepository;

			return ArtifactService.of({
				appendRevision: (ownerUserId, artifactId, payload) =>
					Effect.gen(function* () {
						if (payload.sourceFormatVersion !== 1) {
							return yield* new UnsupportedSourceFormat({
								sourceFormatVersion: payload.sourceFormatVersion,
							});
						}
						const validated = yield* validateArtifactSource(payload.source);
						const result = yield* repository.appendRevision({
							...validated,
							artifactId,
							expectedCurrentRevisionId: payload.expectedCurrentRevisionId,
							idempotencyKey: payload.idempotencyKey,
							now: new Date().toISOString(),
							ownerUserId,
							requestHash: publicationHash({
								expectedCurrentRevisionId: payload.expectedCurrentRevisionId,
								source: payload.source,
								sourceFormatVersion: payload.sourceFormatVersion,
								targetId: artifactId,
							}),
							revisionId: `rev_${crypto.randomUUID()}`,
							sourceFormatVersion: payload.sourceFormatVersion,
						});
						switch (result._tag) {
							case "artifactNotFound":
								yield* recordOperationWarning(
									"Artifact revision target not found",
									{
										"artiflow.artifact.id": artifactId,
										"artiflow.operation.outcome": "not_found",
									},
								);
								return yield* new ArtifactNotFound({ artifactId });
							case "conflict":
								yield* recordOperationWarning("Artifact revision conflict", {
									"artiflow.artifact.id": artifactId,
									"artiflow.operation.outcome": "conflict",
								});
								return yield* new ArtifactRevisionConflict({
									artifactId,
									currentRevisionId: result.currentRevisionId,
									expectedCurrentRevisionId: payload.expectedCurrentRevisionId,
								});
							case "idempotencyConflict":
								yield* recordOperationWarning(
									"Artifact revision idempotency conflict",
									{
										"artiflow.artifact.id": artifactId,
										"artiflow.operation.outcome": "conflict",
									},
								);
								return yield* new IdempotencyConflict({
									idempotencyKey: payload.idempotencyKey,
								});
							case "created":
							case "replayed": {
								const publication = toPublishResult(result.publication);
								yield* recordOperationInfo("Artifact revision persisted", {
									"artiflow.artifact.id": artifactId,
									"artiflow.operation.outcome": result._tag,
									"artiflow.revision.id": publication.revisionId,
									"artiflow.revision.number": publication.revisionNumber,
								});
								return publication;
							}
						}
					}).pipe(
						Effect.withSpan("artiflow.artifact.append_revision", {
							attributes: {
								"artiflow.artifact.id": artifactId,
								"artiflow.source_format.version": payload.sourceFormatVersion,
							},
						}),
					),
				create: (ownerUserId, projectId, payload) =>
					Effect.gen(function* () {
						if (payload.sourceFormatVersion !== 1) {
							return yield* new UnsupportedSourceFormat({
								sourceFormatVersion: payload.sourceFormatVersion,
							});
						}
						const validated = yield* validateArtifactSource(payload.source);
						const result = yield* repository.createArtifact({
							...validated,
							artifactId: `art_${crypto.randomUUID()}`,
							idempotencyKey: payload.idempotencyKey,
							now: new Date().toISOString(),
							ownerUserId,
							projectId,
							requestHash: publicationHash({
								source: payload.source,
								sourceFormatVersion: payload.sourceFormatVersion,
								targetId: projectId,
							}),
							revisionId: `rev_${crypto.randomUUID()}`,
							sourceFormatVersion: payload.sourceFormatVersion,
						});
						switch (result._tag) {
							case "conflict":
								yield* recordOperationWarning(
									"Artifact creation idempotency conflict",
									{
										"artiflow.operation.outcome": "conflict",
										"artiflow.project.id": projectId,
									},
								);
								return yield* new IdempotencyConflict({
									idempotencyKey: payload.idempotencyKey,
								});
							case "projectNotFound":
								yield* recordOperationWarning(
									"Artifact creation project not found",
									{
										"artiflow.operation.outcome": "not_found",
										"artiflow.project.id": projectId,
									},
								);
								return yield* new ProjectNotFound({ projectId });
							case "created":
							case "replayed": {
								const publication = toPublishResult(result.publication);
								yield* recordOperationInfo("Artifact persisted", {
									"artiflow.artifact.id": publication.artifactId,
									"artiflow.operation.outcome": result._tag,
									"artiflow.project.id": projectId,
									"artiflow.revision.id": publication.revisionId,
									"artiflow.revision.number": publication.revisionNumber,
								});
								return publication;
							}
						}
					}).pipe(
						Effect.withSpan("artiflow.artifact.create", {
							attributes: {
								"artiflow.project.id": projectId,
								"artiflow.source_format.version": payload.sourceFormatVersion,
							},
						}),
					),
				delete: (ownerUserId, artifactId) =>
					repository.deleteArtifact(ownerUserId, artifactId).pipe(
						Effect.flatMap((deleted) =>
							deleted
								? Effect.void
								: Effect.fail(new ArtifactNotFound({ artifactId })),
						),
						Effect.tap(() =>
							recordOperationInfo("Artifact deleted", {
								"artiflow.artifact.id": artifactId,
								"artiflow.operation.outcome": "deleted",
							}),
						),
						Effect.withSpan("artiflow.artifact.delete", {
							attributes: { "artiflow.artifact.id": artifactId },
						}),
					),
				get: (ownerUserId, artifactId) =>
					repository.getArtifact(ownerUserId, artifactId).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.fail(new ArtifactNotFound({ artifactId })),
								onSome: Effect.succeed,
							}),
						),
						Effect.withSpan("artiflow.artifact.get", {
							attributes: { "artiflow.artifact.id": artifactId },
						}),
					),
				getPublic: (artifactId) =>
					repository.getPublicArtifact(artifactId).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.fail(new ArtifactNotFound({ artifactId })),
								onSome: Effect.succeed,
							}),
						),
						Effect.withSpan("artiflow.artifact.get_public", {
							attributes: { "artiflow.artifact.id": artifactId },
						}),
					),
				getRevision: (ownerUserId, artifactId, revisionNumber) =>
					Effect.gen(function* () {
						const artifact = yield* repository.getArtifact(
							ownerUserId,
							artifactId,
						);
						if (Option.isNone(artifact))
							return yield* new ArtifactNotFound({ artifactId });
						const revision = yield* repository.getRevision(
							ownerUserId,
							artifactId,
							revisionNumber,
						);
						return yield* Option.match(revision, {
							onNone: () =>
								Effect.fail(
									new RevisionNotFound({
										artifactId,
										revisionNumber: revisionNumber ?? -1,
									}),
								),
							onSome: Effect.succeed,
						});
					}).pipe(
						Effect.withSpan("artiflow.artifact.get_revision", {
							attributes: {
								"artiflow.artifact.id": artifactId,
								...(revisionNumber === undefined
									? {}
									: { "artiflow.revision.number": revisionNumber }),
							},
						}),
					),
				getPublicRevision: (artifactId, revisionNumber) =>
					Effect.gen(function* () {
						const artifact = yield* repository.getPublicArtifact(artifactId);
						if (Option.isNone(artifact))
							return yield* new ArtifactNotFound({ artifactId });
						const revision = yield* repository.getPublicRevision(
							artifactId,
							revisionNumber,
						);
						return yield* Option.match(revision, {
							onNone: () =>
								Effect.fail(
									new RevisionNotFound({
										artifactId,
										revisionNumber: revisionNumber ?? -1,
									}),
								),
							onSome: Effect.succeed,
						});
					}).pipe(
						Effect.withSpan("artiflow.artifact.get_public_revision", {
							attributes: {
								"artiflow.artifact.id": artifactId,
								...(revisionNumber === undefined
									? {}
									: { "artiflow.revision.number": revisionNumber }),
							},
						}),
					),
				list: (ownerUserId, projectId) =>
					repository.listArtifacts(ownerUserId, projectId).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.fail(new ProjectNotFound({ projectId })),
								onSome: Effect.succeed,
							}),
						),
						Effect.withSpan("artiflow.artifact.list", {
							attributes: { "artiflow.project.id": projectId },
						}),
					),
			});
		}),
	);
}
