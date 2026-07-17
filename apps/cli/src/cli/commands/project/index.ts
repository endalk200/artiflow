import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { ArtiflowApiClient, withTransientRetry } from "../../../api-client.js";
import { findProjectManifest, removeProjectManifest, writeProjectManifest } from "../../../project-manifest.js";
import { confirmDestructiveAction } from "../../confirm.js";
import { printResult } from "../../output.js";

const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Print one JSON value"));

const createCommand = Command.make(
	"create",
	{
		json: jsonFlag,
		name: Argument.string("name").pipe(Argument.withDescription("Project display name")),
	},
	({ json, name }) =>
		Effect.gen(function* () {
			const client = yield* ArtiflowApiClient;
			const project = yield* withTransientRetry(
				client.projects.create({
					payload: { idempotencyKey: `project_${crypto.randomUUID()}`, name },
				}),
			);
			const manifest = yield* writeProjectManifest(project.id);
			yield* printResult(
				json,
				{ ...project, manifestPath: manifest.path },
				`Created and linked Project ${project.name} (${project.id}).`,
			);
		}),
).pipe(Command.withDescription("Create a remote Project and link this directory"));

const linkCommand = Command.make(
	"link",
	{
		json: jsonFlag,
		projectId: Argument.string("project-id"),
	},
	({ json, projectId }) =>
		Effect.gen(function* () {
			const client = yield* ArtiflowApiClient;
			const project = yield* client.projects.get({ params: { projectId } });
			const manifest = yield* writeProjectManifest(project.id);
			yield* printResult(
				json,
				{ ...project, manifestPath: manifest.path },
				`Linked ${manifest.directory} to ${project.name} (${project.id}).`,
			);
		}),
).pipe(Command.withDescription("Link this directory to an existing Project"));

const showCommand = Command.make("show", { json: jsonFlag }, ({ json }) =>
	Effect.gen(function* () {
		const manifest = yield* findProjectManifest();
		const client = yield* ArtiflowApiClient;
		const project = yield* client.projects.get({ params: { projectId: manifest.projectId } });
		yield* printResult(
			json,
			{ ...project, manifestPath: manifest.path },
			`${project.name} (${project.id})\nManifest: ${manifest.path}`,
		);
	}),
).pipe(Command.withDescription("Show the linked Project"));

const renameCommand = Command.make(
	"rename",
	{
		json: jsonFlag,
		name: Argument.string("name"),
	},
	({ json, name }) =>
		Effect.gen(function* () {
			const manifest = yield* findProjectManifest();
			const client = yield* ArtiflowApiClient;
			const project = yield* client.projects.rename({
				params: { projectId: manifest.projectId },
				payload: { name },
			});
			yield* printResult(json, project, `Renamed Project to ${project.name}.`);
		}),
).pipe(Command.withDescription("Rename the linked Project"));

const unlinkCommand = Command.make("unlink", { json: jsonFlag }, ({ json }) =>
	Effect.gen(function* () {
		const manifest = yield* removeProjectManifest();
		yield* printResult(
			json,
			{ projectId: manifest.projectId, unlinked: true },
			`Unlinked ${manifest.projectId} from ${manifest.directory}.`,
		);
	}),
).pipe(Command.withDescription("Remove only the local Project binding"));

const deleteCommand = Command.make(
	"delete",
	{
		force: Flag.boolean("force").pipe(Flag.withDescription("Skip interactive confirmation")),
		json: jsonFlag,
	},
	({ force, json }) =>
		Effect.gen(function* () {
			const manifest = yield* findProjectManifest();
			yield* confirmDestructiveAction(manifest.projectId, force, json);
			const client = yield* ArtiflowApiClient;
			yield* client.projects.delete({ params: { projectId: manifest.projectId } });
			yield* removeProjectManifest();
			yield* printResult(
				json,
				{ deleted: true, projectId: manifest.projectId },
				`Deleted Project ${manifest.projectId}.`,
			);
		}),
).pipe(Command.withDescription("Permanently delete the linked Project and all Artifacts"));

export const projectCommand = Command.make("project").pipe(
	Command.withDescription("Manage Artiflow Projects and the local binding"),
	Command.withShortDescription("Manage Projects"),
	Command.withSubcommands([createCommand, linkCommand, showCommand, renameCommand, unlinkCommand, deleteCommand]),
);
