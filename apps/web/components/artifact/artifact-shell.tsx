import { ChevronDown, ChevronRight, History } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtifactTocItem = {
	readonly depth: number;
	readonly title: ReactNode;
	readonly url: string;
};

const dateTimeFormat = new Intl.DateTimeFormat("en", {
	dateStyle: "medium",
	timeStyle: "short",
});

export function ArtifactShell({
	artifactId,
	children,
	description,
	project,
	revisionCreatedAt,
	revisionNumber,
	revisions,
	sourceFormatVersion,
	title,
	toc,
}: {
	readonly artifactId: string;
	readonly children: ReactNode;
	readonly description?: string;
	readonly project: { readonly id: string; readonly name: string };
	readonly revisionCreatedAt: string;
	readonly revisionNumber: number;
	readonly revisions: ReadonlyArray<number>;
	readonly sourceFormatVersion: number;
	readonly title: string;
	readonly toc: ReadonlyArray<ArtifactTocItem>;
}) {
	const latestRevision = Math.max(...revisions);

	return (
		<div className="bg-background">
			{/* Slim toolbar */}
			<div className="sticky top-14 z-30 border-b bg-background/80 backdrop-blur-md">
				<div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
					<nav
						aria-label="Breadcrumb"
						className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground"
					>
						<Link
							className="shrink-0 transition-colors hover:text-foreground"
							href="/projects"
						>
							Projects
						</Link>
						<ChevronRight aria-hidden className="size-3.5 shrink-0" />
						<Link
							className="max-w-40 truncate transition-colors hover:text-foreground"
							href={`/projects/${project.id}`}
						>
							{project.name}
						</Link>
						<ChevronRight aria-hidden className="size-3.5 shrink-0" />
						<span className="truncate text-foreground">{title}</span>
					</nav>

					<details className="group relative shrink-0 text-sm">
						<summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden">
							<History aria-hidden className="size-3.5" />
							Revision {revisionNumber}
							{revisionNumber === latestRevision ? (
								<span className="bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
									latest
								</span>
							) : null}
							<ChevronDown
								aria-hidden
								className="size-3.5 transition-transform group-open:rotate-180"
							/>
						</summary>
						<div className="absolute right-0 z-20 mt-2 min-w-44 overflow-hidden rounded-xl border bg-popover p-1.5 shadow-lg">
							{revisions.map((revision) => (
								<Link
									aria-current={
										revision === revisionNumber ? "page" : undefined
									}
									className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-accent ${
										revision === revisionNumber
											? "font-medium text-foreground"
											: "text-muted-foreground"
									}`}
									href={
										revision === latestRevision
											? `/artifacts/${artifactId}`
											: `/artifacts/${artifactId}/revisions/${revision}`
									}
									key={revision}
								>
									Revision {revision}
									{revision === latestRevision ? (
										<span className="bg-muted px-1.5 py-0.5 text-[10px]">
											latest
										</span>
									) : null}
								</Link>
							))}
						</div>
					</details>
				</div>
			</div>

			<div className="mx-auto grid max-w-7xl gap-12 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_15rem] lg:px-10">
				<div className="min-w-0">
					{/* Compact document header */}
					<header className="mb-7 border-b pb-5">
						<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
							{title}
						</h1>
						{description ? (
							<p className="mt-1.5 max-w-3xl leading-7 text-muted-foreground">
								{description}
							</p>
						) : null}
						<p className="mt-2 text-xs text-muted-foreground">
							Revision {revisionNumber} · Published{" "}
							<time dateTime={revisionCreatedAt}>
								{dateTimeFormat.format(new Date(revisionCreatedAt))}
							</time>{" "}
							· Source Format {sourceFormatVersion}
						</p>
					</header>

					<main className="artifact-prose min-w-0">{children}</main>

					<footer className="mt-16 border-t pt-6">
						<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Revision history
						</p>
						<div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
							{revisions.map((revision) => (
								<Link
									className={`border px-3 py-1 text-xs transition-colors hover:bg-accent ${
										revision === revisionNumber
											? "border-foreground/30 font-medium text-foreground"
											: "text-muted-foreground"
									}`}
									href={
										revision === latestRevision
											? `/artifacts/${artifactId}`
											: `/artifacts/${artifactId}/revisions/${revision}`
									}
									key={revision}
								>
									Revision {revision}
									{revision === latestRevision ? " · latest" : ""}
								</Link>
							))}
						</div>
					</footer>
				</div>

				{toc.length > 0 ? (
					<aside className="hidden lg:block">
						<nav aria-label="On this page" className="sticky top-28">
							<p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
								On this page
							</p>
							<ul className="mt-3 space-y-1 border-l text-sm">
								{toc.map((item) => (
									<li key={item.url}>
										<a
											className="-ml-px block border-l border-transparent py-1 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
											href={item.url}
											style={{
												paddingLeft: `${12 + Math.max(item.depth - 2, 0) * 12}px`,
											}}
										>
											{item.title}
										</a>
									</li>
								))}
							</ul>
						</nav>
					</aside>
				) : null}
			</div>
		</div>
	);
}
