import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { ArtiflowApiClient } from "../../../api-client.js";
import { findProjectManifest } from "../../../project-manifest.js";
import { ArtifactProjectMismatch } from "../../../runtime/command-errors.js";
import { confirmDestructiveAction } from "../../confirm.js";
import { printResult } from "../../output.js";

const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Print one JSON value"));

const listCommand = Command.make("list", { json: jsonFlag }, ({ json }) =>
	Effect.gen(function* () {
		const manifest = yield* findProjectManifest();
		const client = yield* ArtiflowApiClient;
		const artifacts = yield* client.projects.listArtifacts({
			params: { projectId: manifest.projectId },
		});
		yield* printResult(
			json,
			artifacts,
			artifacts.length === 0
				? "No Artifacts published yet."
				: artifacts
						.map((artifact) => `${artifact.id}\t${artifact.title}\t${artifact.revisionCount} revision(s)`)
						.join("\n"),
		);
	}),
).pipe(Command.withDescription("List Artifacts in the linked Project"));

const showCommand = Command.make(
	"show",
	{
		artifactId: Argument.string("artifact-id"),
		json: jsonFlag,
	},
	({ artifactId, json }) =>
		Effect.gen(function* () {
			const manifest = yield* findProjectManifest();
			const client = yield* ArtiflowApiClient;
			const artifact = yield* client.artifacts.get({ params: { artifactId } });
			if (artifact.projectId !== manifest.projectId) {
				return yield* new ArtifactProjectMismatch({
					artifactId,
					artifactProjectId: artifact.projectId,
					linkedProjectId: manifest.projectId,
				});
			}
			yield* printResult(json, artifact, `${artifact.title} (${artifact.id})\n${artifact.revisionCount} revision(s)`);
		}),
).pipe(Command.withDescription("Show Artifact metadata and Revision history"));

const deleteCommand = Command.make(
	"delete",
	{
		artifactId: Argument.string("artifact-id"),
		force: Flag.boolean("force").pipe(Flag.withDescription("Skip interactive confirmation")),
		json: jsonFlag,
	},
	({ artifactId, force, json }) =>
		Effect.gen(function* () {
			const manifest = yield* findProjectManifest();
			const client = yield* ArtiflowApiClient;
			const artifact = yield* client.artifacts.get({ params: { artifactId } });
			if (artifact.projectId !== manifest.projectId) {
				return yield* new ArtifactProjectMismatch({
					artifactId,
					artifactProjectId: artifact.projectId,
					linkedProjectId: manifest.projectId,
				});
			}
			yield* confirmDestructiveAction(artifactId, force, json);
			yield* client.artifacts.delete({ params: { artifactId } });
			yield* printResult(json, { artifactId, deleted: true }, `Deleted Artifact ${artifactId}.`);
		}),
).pipe(Command.withDescription("Permanently delete an Artifact and all Revisions"));

export const artifactCommand = Command.make("artifact").pipe(
	Command.withDescription("Inspect and delete Artifacts"),
	Command.withShortDescription("Manage Artifacts"),
	Command.withSubcommands([listCommand, showCommand, deleteCommand]),
);
