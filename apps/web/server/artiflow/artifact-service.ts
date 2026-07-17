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
		artifactId: string,
	) => Effect.Effect<void, ArtifactNotFound | InfrastructureError>;
	readonly get: (
		artifactId: string,
	) => Effect.Effect<Artifact, ArtifactNotFound | InfrastructureError>;
	readonly getRevision: (
		artifactId: string,
		revisionNumber?: number,
	) => Effect.Effect<
		StoredRevision,
		ArtifactNotFound | InfrastructureError | RevisionNotFound
	>;
	readonly list: (
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
				appendRevision: (artifactId, payload) =>
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
								return yield* new ArtifactNotFound({ artifactId });
							case "conflict":
								return yield* new ArtifactRevisionConflict({
									artifactId,
									currentRevisionId: result.currentRevisionId,
									expectedCurrentRevisionId: payload.expectedCurrentRevisionId,
								});
							case "idempotencyConflict":
								return yield* new IdempotencyConflict({
									idempotencyKey: payload.idempotencyKey,
								});
							case "created":
							case "replayed":
								return toPublishResult(result.publication);
						}
					}),
				create: (projectId, payload) =>
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
								return yield* new IdempotencyConflict({
									idempotencyKey: payload.idempotencyKey,
								});
							case "projectNotFound":
								return yield* new ProjectNotFound({ projectId });
							case "created":
							case "replayed":
								return toPublishResult(result.publication);
						}
					}),
				delete: (artifactId) =>
					repository
						.deleteArtifact(artifactId)
						.pipe(
							Effect.flatMap((deleted) =>
								deleted
									? Effect.void
									: Effect.fail(new ArtifactNotFound({ artifactId })),
							),
						),
				get: (artifactId) =>
					repository.getArtifact(artifactId).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.fail(new ArtifactNotFound({ artifactId })),
								onSome: Effect.succeed,
							}),
						),
					),
				getRevision: (artifactId, revisionNumber) =>
					Effect.gen(function* () {
						const artifact = yield* repository.getArtifact(artifactId);
						if (Option.isNone(artifact))
							return yield* new ArtifactNotFound({ artifactId });
						const revision = yield* repository.getRevision(
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
					}),
				list: (projectId) =>
					repository.listArtifacts(projectId).pipe(
						Effect.flatMap(
							Option.match({
								onNone: () => Effect.fail(new ProjectNotFound({ projectId })),
								onSome: Effect.succeed,
							}),
						),
					),
			});
		}),
	);
}
