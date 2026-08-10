import { compileMDX } from "@fumadocs/mdx-remote";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ArtifactService } from "../../server/artiflow/artifact-service";
import { ProjectService } from "../../server/artiflow/project-service";
import { getServerSession } from "../../server/auth/session";
import { runArtiflow } from "../../server/runtime";
import { ArtifactShell } from "./artifact-shell";
import { visualComponents } from "./visual-components";

const loadArtifactPage = cache(
	async (ownerUserId: string, artifactId: string, revisionNumber?: number) =>
		runArtiflow(
			Effect.gen(function* () {
				const artifacts = yield* ArtifactService;
				const projects = yield* ProjectService;
				const artifact = yield* artifacts.get(ownerUserId, artifactId);
				return {
					artifact,
					project: yield* projects.get(ownerUserId, artifact.projectId),
					revision: yield* artifacts.getRevision(
						ownerUserId,
						artifactId,
						revisionNumber,
					),
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

const artifactPath = (artifactId: string, revisionNumber?: number) =>
	revisionNumber === undefined
		? `/artifacts/${artifactId}`
		: `/artifacts/${artifactId}/revisions/${revisionNumber}`;

const requireArtifactSession = async (
	artifactId: string,
	revisionNumber?: number,
) => {
	const session = await getServerSession();
	if (session === null) {
		const callbackURL = artifactPath(artifactId, revisionNumber);
		redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`);
	}
	return session;
};

export async function generateArtifactMetadata(
	artifactId: string,
	revisionNumber?: number,
): Promise<Metadata> {
	const session = await requireArtifactSession(artifactId, revisionNumber);
	const result = await loadArtifactPage(
		session.user.id,
		artifactId,
		revisionNumber,
	);

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
	const session = await requireArtifactSession(artifactId, revisionNumber);
	const result = await loadArtifactPage(
		session.user.id,
		artifactId,
		revisionNumber,
	);

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
