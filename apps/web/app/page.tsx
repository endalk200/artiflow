import {
	ArrowRight,
	BookOpenText,
	GitBranch,
	ShieldCheck,
	Sparkles,
	Terminal,
	Workflow,
} from "lucide-react";
import Link from "next/link";

import { CopyButton } from "../components/site/copy-button";

const CLI_INSTALL_COMMAND = "npm install -g artiflow";
const SKILL_INSTALL_COMMAND =
	"npx skills add https://github.com/endalk200/artiflow";

const AGENT_SETUP_PROMPT = `Set up Artiflow in this repository so you can publish visual artifacts:

1. Install the Artiflow CLI globally: \`${CLI_INSTALL_COMMAND}\` (verify with \`artiflow version\`).
2. Install the Artiflow agent Skill: \`${SKILL_INSTALL_COMMAND}\`.
3. If this repository has no \`.artiflow/project.json\` yet, create a project for it: \`artiflow project create "<short name for this repository>"\`.
4. Confirm everything works: \`artiflow project show --json\`.

From now on, when I ask you to turn a plan, report, review, or explanation into a visual document, invoke the Artiflow Skill and publish it as an Artifact.`;

const SETUP_STEPS = [
	{
		command: CLI_INSTALL_COMMAND,
		description:
			"The CLI validates, smoke-renders, and publishes Artifact Source against your local Artiflow.",
		title: "Install the CLI",
	},
	{
		command: SKILL_INSTALL_COMMAND,
		description:
			"Adds the explicit-only Artiflow Skill to this project. Append --global to make it available across projects.",
		title: "Install the agent Skill",
	},
	{
		command: 'artiflow project create "My project"',
		description:
			"Creates a Project and writes .artiflow/project.json so publications land in the right place.",
		title: "Create a Project",
	},
] as const;

const FEATURES = [
	{
		description:
			"Invoke the Artiflow Skill when a plan, review, or report deserves a clearer visual form. Your agent authors one self-contained Artifact Source.",
		icon: Sparkles,
		title: "Agent-authored",
	},
	{
		description:
			"Every publication is validated and smoke-rendered before it is committed atomically. Invalid Artifact Source never reaches readers.",
		icon: ShieldCheck,
		title: "Validated publishing",
	},
	{
		description:
			"Artifacts live at stable URLs with an immutable Revision history, so a plan and its evolution stay reviewable forever.",
		icon: GitBranch,
		title: "Durable Revisions",
	},
	{
		description:
			"Diagrams, callouts, timelines, comparisons, and stat grids turn dense agent output into documents people actually read.",
		icon: BookOpenText,
		title: "Built to be read",
	},
] as const;

function CommandBlock({ command }: { readonly command: string }) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 py-1.5 pr-1.5 pl-3.5">
			<code className="truncate font-mono text-[13px] text-foreground/90">
				<span className="mr-2 select-none text-muted-foreground">$</span>
				{command}
			</code>
			<CopyButton
				className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				label=""
				value={command}
			/>
		</div>
	);
}

export default function Home() {
	return (
		<main className="overflow-hidden">
			{/* Hero */}
			<section className="relative border-b">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,--alpha(var(--color-foreground)/6%),transparent)]"
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,--alpha(var(--color-border)/40%)_1px,transparent_1px),linear-gradient(to_bottom,--alpha(var(--color-border)/40%)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
				/>

				<div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-32">
					<div>
						<p className="inline-flex items-center gap-2 border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
							<Sparkles aria-hidden className="size-3.5" />
							Visual documents for agent work
						</p>
						<h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
							See the plan.
							<br />
							<span className="text-muted-foreground">
								Understand the work.
							</span>
						</h1>
						<p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
							Artiflow turns agent-authored plans, summaries, reviews, and
							explanations into focused visual Artifacts — with diagrams,
							callouts, timelines, and durable Revision history.
						</p>
						<div className="mt-10 flex flex-wrap items-center gap-3">
							<Link
								className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
								href="/projects"
							>
								Browse projects
								<ArrowRight aria-hidden className="size-4" />
							</Link>
							<a
								className="inline-flex items-center gap-2 border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent"
								href="#getting-started"
							>
								<Terminal aria-hidden className="size-4" />
								Get started
							</a>
						</div>
					</div>

					{/* Artifact preview mock */}
					<div className="relative hidden lg:block">
						<div
							aria-hidden
							className="absolute -inset-6 rounded-[2rem] bg-gradient-to-b from-foreground/8 to-transparent blur-2xl"
						/>
						<div className="relative rounded-2xl border bg-card shadow-2xl shadow-foreground/10">
							<div className="flex items-center justify-between border-b px-5 py-3">
								<div className="flex items-center gap-1.5">
									<span className="size-2.5 bg-border" />
									<span className="size-2.5 bg-border" />
									<span className="size-2.5 bg-border" />
								</div>
								<span className="border px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
									Revision 3
								</span>
							</div>
							<div className="space-y-5 p-7">
								<div>
									<p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
										Artifact
									</p>
									<p className="mt-1.5 text-xl font-semibold tracking-tight">
										Migration plan: payments service
									</p>
								</div>
								<div className="rounded-lg border border-l-4 border-l-foreground bg-muted/50 p-4">
									<p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
										Decision
									</p>
									<p className="mt-1.5 text-sm font-medium">
										Strangle the monolith behind a routing proxy.
									</p>
								</div>
								<div className="space-y-3">
									{[
										"Freeze schema changes on legacy tables",
										"Dual-write orders through the proxy",
										"Cut over reads, then retire the old path",
									].map((step, index) => (
										<div className="flex items-start gap-3" key={step}>
											<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center border bg-background font-mono text-[10px] text-muted-foreground">
												{index + 1}
											</span>
											<p className="text-sm leading-6 text-muted-foreground">
												{step}
											</p>
										</div>
									))}
								</div>
								<div className="grid grid-cols-3 gap-3">
									{[
										["Services", "12"],
										["Cutover", "Q3"],
										["Risk", "Low"],
									].map(([label, value]) => (
										<div className="rounded-lg border p-3" key={label}>
											<p className="text-[10px] text-muted-foreground">
												{label}
											</p>
											<p className="mt-0.5 text-lg font-semibold tracking-tight">
												{value}
											</p>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="border-b">
				<div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
					<div className="max-w-2xl">
						<p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Why Artiflow
						</p>
						<h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
							Agent output, made legible
						</h2>
					</div>
					<div className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
						{FEATURES.map((feature) => (
							<article className="bg-card p-8" key={feature.title}>
								<feature.icon
									aria-hidden
									className="size-5 text-muted-foreground"
								/>
								<h3 className="mt-6 text-lg font-semibold tracking-tight">
									{feature.title}
								</h3>
								<p className="mt-2.5 text-[15px] leading-7 text-muted-foreground">
									{feature.description}
								</p>
							</article>
						))}
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="border-b">
				<div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
					<div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
						<div>
							<p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
								How it works
							</p>
							<h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
								From prompt to published document
							</h2>
							<p className="mt-5 max-w-md leading-7 text-muted-foreground">
								You keep working with your agent the way you already do.
								Artiflow gives its most important output a permanent, visual
								home.
							</p>
						</div>
						<ol className="space-y-4">
							{[
								[
									"Author",
									"Ask your agent for a plan, review, or explanation and invoke the Artiflow Skill. It authors one self-contained visual document.",
								],
								[
									"Publish",
									"The CLI validates and smoke-renders Artifact Source, then commits it atomically as a new Artifact or Revision.",
								],
								[
									"Read",
									"Open the stable Artifact URL — table of contents, diagrams, and the full Revision history, ready to share.",
								],
							].map(([title, description], index) => (
								<li
									className="flex gap-5 rounded-2xl border bg-card p-6"
									key={title}
								>
									<span className="flex size-9 shrink-0 items-center justify-center border bg-background font-mono text-sm text-muted-foreground">
										0{index + 1}
									</span>
									<div>
										<h3 className="font-semibold tracking-tight">{title}</h3>
										<p className="mt-1.5 text-[15px] leading-7 text-muted-foreground">
											{description}
										</p>
									</div>
								</li>
							))}
						</ol>
					</div>
				</div>
			</section>

			{/* Getting started */}
			<section className="scroll-mt-14 border-b" id="getting-started">
				<div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
					<div className="max-w-2xl">
						<p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Getting started
						</p>
						<h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
							Set up in three commands
						</h2>
						<p className="mt-5 leading-7 text-muted-foreground">
							Run the steps yourself — or copy the prompt on the right and let
							your agent do the whole setup for you.
						</p>
					</div>

					<div className="mt-14 grid items-start gap-8 lg:grid-cols-[1.05fr_0.95fr]">
						<ol className="space-y-4">
							{SETUP_STEPS.map((step, index) => (
								<li className="rounded-2xl border bg-card p-6" key={step.title}>
									<div className="flex items-center gap-3">
										<span className="flex size-7 shrink-0 items-center justify-center border bg-background font-mono text-xs text-muted-foreground">
											{index + 1}
										</span>
										<h3 className="font-semibold tracking-tight">
											{step.title}
										</h3>
									</div>
									<p className="mt-3 text-sm leading-6 text-muted-foreground">
										{step.description}
									</p>
									<div className="mt-4">
										<CommandBlock command={step.command} />
									</div>
								</li>
							))}
						</ol>

						<aside className="lg:sticky lg:top-20">
							<div className="overflow-hidden rounded-2xl border bg-card shadow-lg shadow-foreground/5">
								<div className="flex items-center justify-between gap-4 border-b bg-muted/40 px-6 py-4">
									<div className="flex items-center gap-2.5">
										<Workflow
											aria-hidden
											className="size-4 text-muted-foreground"
										/>
										<h3 className="text-sm font-semibold tracking-tight">
											Let your agent set it up
										</h3>
									</div>
									<CopyButton label="Copy prompt" value={AGENT_SETUP_PROMPT} />
								</div>
								<div className="px-6 py-5">
									<p className="text-sm leading-6 text-muted-foreground">
										Paste this prompt into Codex, OpenCode, Claude Code, Cursor,
										or another coding agent with terminal access:
									</p>
									<pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-6 text-foreground/85">
										{AGENT_SETUP_PROMPT}
									</pre>
								</div>
							</div>
						</aside>
					</div>
				</div>
			</section>

			{/* Footer CTA */}
			<section>
				<div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-20 sm:flex-row sm:items-center lg:px-10">
					<div>
						<h2 className="text-2xl font-semibold tracking-tight">
							Ready when your agent is.
						</h2>
						<p className="mt-2 text-muted-foreground">
							Create a project and publish your first visual Artifact.
						</p>
					</div>
					<Link
						className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
						href="/projects"
					>
						Open projects
						<ArrowRight aria-hidden className="size-4" />
					</Link>
				</div>
				<footer className="border-t">
					<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8 text-sm text-muted-foreground lg:px-10">
						<p>Artiflow — visual documents for agent work.</p>
						<a
							className="transition-colors hover:text-foreground"
							href="https://github.com/endalk200/artiflow"
							rel="noreferrer"
							target="_blank"
						>
							GitHub
						</a>
					</div>
				</footer>
			</section>
		</main>
	);
}
