import { Effect } from "effect";
import type { Metadata } from "next";

import { ProjectsPageView } from "../../components/project/projects-page-view";
import { ProjectService } from "../../server/artiflow/project-service";
import { runArtiflow } from "../../server/runtime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Projects",
};

export default async function ProjectsPage() {
	const projects = await runArtiflow(
		Effect.gen(function* () {
			const service = yield* ProjectService;
			return yield* service.list();
		}),
	);

	return (
		<ProjectsPageView
			projects={projects.map(({ artifactCount, project }) => ({
				artifactCount,
				createdAt: project.createdAt,
				id: project.id,
				name: project.name,
				updatedAt: project.updatedAt,
			}))}
		/>
	);
}
