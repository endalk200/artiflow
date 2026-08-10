import { Effect, FileSystem, Option, Path } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { ArtiflowApiClient, withTransientRetry } from "../../api-client.js";
import { requireCredential } from "../../auth/require-credential.js";
import { findProjectManifest } from "../../project-manifest.js";
import { ArtifactProjectMismatch, SourceFileError } from "../../runtime/command-errors.js";
import { printResult } from "../output.js";

export const publishCommand = Command.make(
	"publish",
	{
		artifactId: Flag.string("artifact").pipe(Flag.withDescription("Append to this existing Artifact"), Flag.optional),
		json: Flag.boolean("json").pipe(Flag.withDescription("Print one JSON value")),
		sourcePath: Argument.string("source").pipe(Argument.withDescription("Local MDX file containing Artifact Source")),
	},
	({ artifactId, json, sourcePath }) =>
		Effect.gen(function* () {
			yield* requireCredential;
			const manifest = yield* findProjectManifest();
			const fs = yield* FileSystem.FileSystem;
			const pathService = yield* Path.Path;
			const resolvedSourcePath = pathService.resolve(sourcePath);
			const source = yield* fs.readFileString(resolvedSourcePath).pipe(
				Effect.mapError(
					(cause) =>
						new SourceFileError({
							cause,
							message: cause.message,
							path: resolvedSourcePath,
						}),
				),
			);
			const client = yield* ArtiflowApiClient;
			const idempotencyKey = `publication_${crypto.randomUUID()}`;

			const publication = yield* Option.match(artifactId, {
				onNone: () =>
					withTransientRetry(
						client.projects.createArtifact({
							params: { projectId: manifest.projectId },
							payload: { idempotencyKey, source, sourceFormatVersion: 1 },
						}),
					),
				onSome: (existingArtifactId) =>
					Effect.gen(function* () {
						const artifact = yield* client.artifacts.get({
							params: { artifactId: existingArtifactId },
						});
						if (artifact.projectId !== manifest.projectId) {
							return yield* new ArtifactProjectMismatch({
								artifactId: existingArtifactId,
								artifactProjectId: artifact.projectId,
								linkedProjectId: manifest.projectId,
							});
						}
						return yield* withTransientRetry(
							client.artifacts.appendRevision({
								params: { artifactId: existingArtifactId },
								payload: {
									expectedCurrentRevisionId: artifact.currentRevisionId,
									idempotencyKey,
									source,
									sourceFormatVersion: 1,
								},
							}),
						);
					}),
			});

			yield* printResult(json, publication, `Published Revision ${publication.revisionNumber}: ${publication.url}`);
		}),
).pipe(Command.withDescription("Publish MDX as a new Artifact or immutable Revision"));
