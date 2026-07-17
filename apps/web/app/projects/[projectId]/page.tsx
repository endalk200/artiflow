import { Effect } from "effect";
import { notFound } from "next/navigation";

import { ProjectPageView } from "../../../components/project/project-page-view";
import { ArtifactService } from "../../../server/artiflow/artifact-service";
import { ProjectService } from "../../../server/artiflow/project-service";
import { artiflowRuntime } from "../../../server/runtime";

export default async function ProjectPage({
	params,
}: {
	readonly params: Promise<{ readonly projectId: string }>;
}) {
	const { projectId } = await params;
	const result = await artiflowRuntime.runPromise(
		Effect.gen(function* () {
			const projects = yield* ProjectService;
			const artifacts = yield* ArtifactService;
			return {
				artifacts: yield* artifacts.list(projectId),
				project: yield* projects.get(projectId),
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
