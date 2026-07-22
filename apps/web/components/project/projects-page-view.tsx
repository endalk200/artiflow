import { ArrowUpRight, FolderOpen, Layers } from "lucide-react";
import Link from "next/link";

import { CreateProjectForm } from "./create-project-form";
import { DeleteProjectButton } from "./delete-project-button";

export type ProjectListRow = {
	readonly artifactCount: number;
	readonly createdAt: string;
	readonly id: string;
	readonly name: string;
	readonly updatedAt: string;
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function ProjectsPageView({
	projects,
}: {
	readonly projects: ReadonlyArray<ProjectListRow>;
}) {
	return (
		<main className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
			<header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
					<p className="mt-2 text-muted-foreground">
						{projects.length === 0
							? "Each Project collects the visual Artifacts your agents publish."
							: `${projects.length} ${projects.length === 1 ? "project" : "projects"} · Artifacts your agents publish live here.`}
					</p>
				</div>
				<CreateProjectForm />
			</header>

			{projects.length === 0 ? (
				<section className="mt-10 rounded-2xl border border-dashed bg-card/50 px-8 py-20 text-center">
					<div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-background">
						<FolderOpen aria-hidden className="size-5 text-muted-foreground" />
					</div>
					<h2 className="mt-6 text-xl font-semibold tracking-tight">
						No projects yet
					</h2>
					<p className="mx-auto mt-2.5 max-w-md leading-7 text-muted-foreground">
						Create your first project above, or from a repository with the CLI:
					</p>
					<code className="mt-5 inline-block rounded-lg border bg-muted/40 px-4 py-2 font-mono text-[13px] text-foreground/90">
						<span className="mr-2 select-none text-muted-foreground">$</span>
						artiflow project create &quot;My project&quot;
					</code>
				</section>
			) : (
				<section
					aria-label="Projects"
					className="mt-10 overflow-hidden rounded-2xl border bg-card"
				>
					<div className="hidden items-center gap-4 border-b bg-muted/30 px-6 py-2.5 text-xs font-medium text-muted-foreground sm:flex">
						<span className="flex-1">Name</span>
						<span className="w-24 text-right">Artifacts</span>
						<span className="w-28 text-right">Updated</span>
						<span className="w-36" />
					</div>
					<ul className="divide-y">
						{projects.map((project) => (
							<li
								className="group relative flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-4"
								key={project.id}
							>
								<div className="flex min-w-0 flex-1 items-center gap-3.5">
									<span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
										<Layers aria-hidden className="size-4" />
									</span>
									<div className="min-w-0">
										<Link
											className="block truncate font-medium tracking-tight after:absolute after:inset-0"
											href={`/projects/${project.id}`}
										>
											{project.name}
										</Link>
										<p className="truncate font-mono text-xs text-muted-foreground">
											{project.id}
										</p>
									</div>
								</div>
								<span className="w-24 text-sm text-muted-foreground tabular-nums sm:text-right">
									{project.artifactCount}{" "}
									<span className="sm:hidden">
										{project.artifactCount === 1 ? "artifact" : "artifacts"}
									</span>
								</span>
								<time
									className="w-28 text-sm text-muted-foreground sm:text-right"
									dateTime={project.updatedAt}
								>
									{dateFormat.format(new Date(project.updatedAt))}
								</time>
								<span className="relative z-10 flex min-w-36 shrink-0 items-center justify-end gap-1">
									<DeleteProjectButton
										projectId={project.id}
										projectName={project.name}
									/>
									<Link
										aria-label={`Open project ${project.name}`}
										className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
										href={`/projects/${project.id}`}
									>
										<ArrowUpRight aria-hidden className="size-4" />
									</Link>
								</span>
							</li>
						))}
					</ul>
				</section>
			)}
		</main>
	);
}
