"use server";

import { Effect } from "effect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ProjectService } from "../../server/artiflow/project-service";
import { getServerSession } from "../../server/auth/session";
import { runArtiflow } from "../../server/runtime";

export type ProjectActionState = {
	readonly error?: string;
};

export async function createProjectAction(
	_previousState: ProjectActionState,
	formData: FormData,
): Promise<ProjectActionState> {
	const session = await getServerSession();
	if (session === null) redirect("/sign-in?callbackURL=%2Fprojects");

	const name = formData.get("name");
	if (typeof name !== "string") {
		return { error: "Project name is required." };
	}

	const result = await runArtiflow(
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			yield* projects.create(session.user.id, {
				idempotencyKey: `web_${crypto.randomUUID()}`,
				name,
			});
			return { error: undefined };
		}).pipe(
			Effect.catchTags({
				IdempotencyConflict: () =>
					Effect.succeed({ error: "Please try again." }),
				InfrastructureError: () =>
					Effect.succeed({
						error: "Something went wrong while creating the project.",
					}),
				InvalidProjectName: (failure) =>
					Effect.succeed({ error: failure.message }),
			}),
		),
	);

	if (result.error !== undefined) return { error: result.error };

	revalidatePath("/projects");
	return {};
}

export async function deleteProjectAction(projectId: string): Promise<void> {
	const session = await getServerSession();
	if (session === null) redirect("/sign-in?callbackURL=%2Fprojects");

	await runArtiflow(
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			yield* projects.delete(session.user.id, projectId);
		}).pipe(
			Effect.catchTags({
				InfrastructureError: () => Effect.void,
				ProjectNotFound: () => Effect.void,
			}),
		),
	);

	revalidatePath("/projects");
	revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAndLeaveAction(
	projectId: string,
): Promise<void> {
	await deleteProjectAction(projectId);
	redirect("/projects");
}

export async function renameProjectAction(
	projectId: string,
	_previousState: ProjectActionState,
	formData: FormData,
): Promise<ProjectActionState> {
	const session = await getServerSession();
	if (session === null) redirect("/sign-in?callbackURL=%2Fprojects");

	const name = formData.get("name");
	if (typeof name !== "string") {
		return { error: "Project name is required." };
	}

	const result = await runArtiflow(
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			yield* projects.rename(session.user.id, projectId, name);
			return { error: undefined };
		}).pipe(
			Effect.catchTags({
				InfrastructureError: () =>
					Effect.succeed({
						error: "Something went wrong while renaming the project.",
					}),
				InvalidProjectName: (failure) =>
					Effect.succeed({ error: failure.message }),
				ProjectNotFound: () =>
					Effect.succeed({ error: "This project no longer exists." }),
			}),
		),
	);

	if (result.error !== undefined) return { error: result.error };

	revalidatePath("/projects");
	revalidatePath(`/projects/${projectId}`);
	return {};
}
