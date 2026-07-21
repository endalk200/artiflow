import { compileMDX } from "@fumadocs/mdx-remote";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ArtifactService } from "../../server/artiflow/artifact-service";
import { ProjectService } from "../../server/artiflow/project-service";
import { runArtiflow } from "../../server/runtime";
import { ArtifactShell } from "./artifact-shell";
import { visualComponents } from "./visual-components";

const loadArtifactPage = cache(
	async (artifactId: string, revisionNumber?: number) =>
		runArtiflow(
			Effect.gen(function* () {
				const artifacts = yield* ArtifactService;
				const projects = yield* ProjectService;
				const artifact = yield* artifacts.get(artifactId);
				return {
					artifact,
					project: yield* projects.get(artifact.projectId),
					revision: yield* artifacts.getRevision(artifactId, revisionNumber),
				};
			}).pipe(
				Effect.map((value) => value as typeof value | null),
				Effect.catchTags({
					ArtifactNotFound: () => Effect.succeed(null),
					ProjectNotFound: () => Effect.succeed(null),
					RevisionNotFound: () => Effect.succeed(null),
				}),
			),
		),
);

export async function generateArtifactMetadata(
	artifactId: string,
	revisionNumber?: number,
): Promise<Metadata> {
	const result = await loadArtifactPage(artifactId, revisionNumber);

	if (result === null) notFound();

	return { title: result.revision.title };
}

export async function ArtifactPage({
	artifactId,
	revisionNumber,
}: {
	readonly artifactId: string;
	readonly revisionNumber?: number;
}) {
	const result = await loadArtifactPage(artifactId, revisionNumber);

	if (result === null) notFound();

	const compiled = await compileMDX({
		components: visualComponents,
		mdxOptions: { preset: "fumadocs", remarkImageOptions: false },
		source: result.revision.source,
	});
	const content = await compiled.body({ components: visualComponents });

	return (
		<ArtifactShell
			artifactId={result.artifact.id}
			description={result.revision.description}
			project={result.project}
			revisionCreatedAt={result.revision.createdAt}
			revisionNumber={result.revision.number}
			revisions={result.artifact.revisions.map((revision) => revision.number)}
			sourceFormatVersion={result.revision.sourceFormatVersion}
			title={result.revision.title}
			toc={compiled.toc}
		>
			{content}
		</ArtifactShell>
	);
}
