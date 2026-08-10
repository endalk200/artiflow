import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";

import { ProjectPageView } from "../../../components/project/project-page-view";
import { ArtifactService } from "../../../server/artiflow/artifact-service";
import { ProjectService } from "../../../server/artiflow/project-service";
import { getServerSession } from "../../../server/auth/session";
import { runArtiflow } from "../../../server/runtime";

export default async function ProjectPage({
	params,
}: {
	readonly params: Promise<{ readonly projectId: string }>;
}) {
	const { projectId } = await params;
	const session = await getServerSession();
	if (session === null) {
		redirect(
			`/sign-in?callbackURL=${encodeURIComponent(`/projects/${projectId}`)}`,
		);
	}
	const result = await runArtiflow(
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			return {
				artifacts: yield* artifacts.list(session.user.id, projectId),
				project: yield* projects.get(session.user.id, projectId),
			};
		}).pipe(
			Effect.map((value) => value as typeof value | null),
			Effect.catchTags({
				ProjectNotFound: () => Effect.succeed(null),
			}),
		),
	);

	if (result === null) notFound();

	return (
		<ProjectPageView artifacts={result.artifacts} project={result.project} />
	);
}
