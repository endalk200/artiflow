import { ChevronRight, FileText, History, Sparkles } from "lucide-react";
import Link from "next/link";

import { CopyButton } from "../site/copy-button";
import { DeleteProjectButton } from "./delete-project-button";
import { RenameProjectControl } from "./rename-project-control";

type ProjectArtifact = {
	readonly description?: string;
	readonly id: string;
	readonly revisionCount: number;
	readonly title: string;
	readonly updatedAt: string;
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

const publishPrompt = (projectName: string) =>
	`Use the Artiflow Skill to turn your latest plan or summary for "${projectName}" into a visual Artifact and publish it with the artiflow CLI.`;

export function ProjectPageView({
	artifacts,
	project,
}: {
	readonly artifacts: ReadonlyArray<ProjectArtifact>;
	readonly project: { readonly id: string; readonly name: string };
}) {
	return (
		<main className="mx-auto w-full max-w-5xl px-6 py-10 lg:px-10">
			<nav
				aria-label="Breadcrumb"
				className="flex items-center gap-1.5 text-sm text-muted-foreground"
			>
				<Link
					className="transition-colors hover:text-foreground"
					href="/projects"
				>
					Projects
				</Link>
				<ChevronRight aria-hidden className="size-3.5" />
				<span className="truncate text-foreground">{project.name}</span>
			</nav>

			<header className="mt-5 flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-start">
				<div className="min-w-0">
					<h1 className="truncate text-3xl font-semibold tracking-tight">
						{project.name}
					</h1>
					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
						<span className="font-mono text-xs">{project.id}</span>
						<span aria-hidden className="text-border">
							·
						</span>
						<span>
							{artifacts.length}{" "}
							{artifacts.length === 1 ? "artifact" : "artifacts"}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<RenameProjectControl
						projectId={project.id}
						projectName={project.name}
					/>
					<DeleteProjectButton
						projectId={project.id}
						projectName={project.name}
						redirectAfter
					/>
				</div>
			</header>

			{artifacts.length === 0 ? (
				<section className="mt-10 overflow-hidden rounded-2xl border border-dashed bg-card/50">
					<div className="px-8 py-16 text-center">
						<div className="mx-auto flex size-12 items-center justify-center rounded-xl border bg-background">
							<Sparkles aria-hidden className="size-5 text-muted-foreground" />
						</div>
						<h2 className="mt-6 text-xl font-semibold tracking-tight">
							Publish your first visual Artifact
						</h2>
						<p className="mx-auto mt-2.5 max-w-md leading-7 text-muted-foreground">
							Invoke the Artiflow Skill from your coding agent to turn a plan,
							report, or explanation into an interactive document.
						</p>
						<div className="mx-auto mt-8 max-w-lg rounded-xl border bg-background p-4 text-left">
							<div className="flex items-center justify-between gap-4">
								<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
									Prompt your agent
								</p>
								<CopyButton label="Copy" value={publishPrompt(project.name)} />
							</div>
							<p className="mt-3 font-mono text-xs leading-6 text-foreground/85">
								{publishPrompt(project.name)}
							</p>
						</div>
						<p className="mt-6 text-sm text-muted-foreground">
							New here? Follow the{" "}
							<Link
								className="font-medium text-foreground underline underline-offset-4"
								href="/#getting-started"
							>
								getting started guide
							</Link>
							.
						</p>
					</div>
				</section>
			) : (
				<section
					aria-label="Artifacts"
					className="mt-8 overflow-hidden rounded-2xl border bg-card"
				>
					<ul className="divide-y">
						{artifacts.map((artifact) => (
							<li
								className="group relative flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/40"
								key={artifact.id}
							>
								<span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
									<FileText aria-hidden className="size-4" />
								</span>
								<div className="min-w-0 flex-1">
									<Link
										className="block truncate font-medium tracking-tight after:absolute after:inset-0"
										href={`/artifacts/${artifact.id}`}
									>
										{artifact.title}
									</Link>
									{artifact.description ? (
										<p className="mt-0.5 truncate text-sm text-muted-foreground">
											{artifact.description}
										</p>
									) : null}
								</div>
								<span className="hidden shrink-0 items-center gap-1.5 border bg-background px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
									<History aria-hidden className="size-3" />
									{artifact.revisionCount}{" "}
									{artifact.revisionCount === 1 ? "revision" : "revisions"}
								</span>
								<time
									className="hidden w-28 shrink-0 text-right text-sm text-muted-foreground md:block"
									dateTime={artifact.updatedAt}
								>
									{dateFormat.format(new Date(artifact.updatedAt))}
								</time>
								<ChevronRight
									aria-hidden
									className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
								/>
							</li>
						))}
					</ul>
				</section>
			)}
		</main>
	);
}
