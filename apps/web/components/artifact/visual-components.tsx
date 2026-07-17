import { CircleAlert, CircleCheck, Info, StickyNote } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { MermaidDiagram } from "./mermaid-diagram";

const panel =
	"rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm";
const standalonePanel = `my-6 ${panel}`;
const trimContentMargins = "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

const calloutVariants = {
	info: {
		container: "border-l-blue-500 bg-blue-500/5",
		icon: Info,
		iconColor: "text-blue-500",
	},
	note: {
		container: "border-l-foreground/40 bg-muted/40",
		icon: StickyNote,
		iconColor: "text-muted-foreground",
	},
	success: {
		container: "border-l-emerald-500 bg-emerald-500/5",
		icon: CircleCheck,
		iconColor: "text-emerald-500",
	},
	warning: {
		container: "border-l-amber-500 bg-amber-500/5",
		icon: CircleAlert,
		iconColor: "text-amber-500",
	},
} as const;

export function Callout({
	children,
	title,
	type = "note",
}: {
	readonly children?: ReactNode;
	readonly title?: string;
	readonly type?: "info" | "note" | "success" | "warning";
}) {
	const variant = calloutVariants[type] ?? calloutVariants.note;
	const Icon = variant.icon;
	return (
		<div
			className={`my-6 flex gap-3 border border-l-2 border-border p-4 ${variant.container}`}
			data-callout-type={type}
			role="note"
		>
			<Icon
				aria-hidden
				className={`mt-0.5 size-4 shrink-0 ${variant.iconColor}`}
			/>
			<div className="min-w-0 flex-1">
				{title ? (
					<p className="mt-0 mb-1.5 font-semibold leading-5">{title}</p>
				) : null}
				<div className={`text-[15px] leading-6 ${trimContentMargins}`}>
					{children}
				</div>
			</div>
		</div>
	);
}

export function Steps({ children }: { readonly children?: ReactNode }) {
	return <ol className="my-6 list-none space-y-4 border-l pl-6">{children}</ol>;
}

export function Step({
	children,
	title,
}: {
	readonly children?: ReactNode;
	readonly title?: string;
}) {
	return (
		<li className="relative">
			<span className="absolute -left-[1.93rem] top-1 size-3 bg-primary" />
			{title ? <h3 className="m-0 font-semibold">{title}</h3> : null}
			<div className={`${title ? "mt-2" : ""} ${trimContentMargins}`}>
				{children}
			</div>
		</li>
	);
}

export function FileTree({ children }: { readonly children?: ReactNode }) {
	return (
		<pre className={`${standalonePanel} overflow-x-auto font-mono text-sm`}>
			{children}
		</pre>
	);
}

export const Mermaid = Object.assign(
	function Mermaid({
		children,
		chart,
	}: {
		readonly children?: ReactNode;
		readonly chart?: string;
	}) {
		const diagram = chart ?? (typeof children === "string" ? children : "");
		return (
			<figure className={`${standalonePanel} overflow-x-auto`} data-mermaid>
				<MermaidDiagram chart={diagram} />
			</figure>
		);
	},
	// The publication smoke render validates the server component tree without
	// executing client-only React boundaries.
	{ artiflowSmokeOpaque: true as const },
);

export function Timeline({ children }: { readonly children?: ReactNode }) {
	return <div className="my-6 space-y-0 border-l pl-6">{children}</div>;
}

export function TimelineItem({
	children,
	title,
}: {
	readonly children?: ReactNode;
	readonly title: string;
}) {
	return (
		<section className="relative pb-6 last:pb-0">
			<span className="absolute -left-[1.78rem] top-1.5 size-2 bg-primary" />
			<h3 className="m-0 font-semibold">{title}</h3>
			<div className={`mt-2 ${trimContentMargins}`}>{children}</div>
		</section>
	);
}

export function Comparison({
	children,
	left,
	right,
}: {
	readonly children?: ReactNode;
	readonly left?: ReactNode;
	readonly right?: ReactNode;
}) {
	return (
		<div className="my-6 grid gap-4 md:grid-cols-2">
			{left !== undefined || right !== undefined ? (
				<>
					<div className={`${panel} ${trimContentMargins}`}>{left}</div>
					<div className={`${panel} ${trimContentMargins}`}>{right}</div>
				</>
			) : (
				children
			)}
		</div>
	);
}

export function Checklist({ children }: { readonly children?: ReactNode }) {
	return (
		<div
			className={`${standalonePanel} [&_ul]:my-0 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-0 [&_li]:my-0`}
			data-checklist
		>
			{children}
		</div>
	);
}

export function StatGrid({ children }: { readonly children?: ReactNode }) {
	return (
		<div className="my-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-4">
			{children}
		</div>
	);
}

export function Stat({
	description,
	label,
	value,
}: {
	readonly description?: string;
	readonly label: string;
	readonly value: ReactNode;
}) {
	return (
		<div className={panel}>
			<p className="m-0 text-sm text-muted-foreground">{label}</p>
			<p className="mt-1 mb-0 text-3xl font-semibold tracking-tight">{value}</p>
			{description ? (
				<p className="mt-2 mb-0 text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}

const ExternalImage = (props: ComponentPropsWithoutRef<"img">) => {
	const source = typeof props.src === "string" ? props.src : "";
	if (!/^https?:\/\//.test(source)) {
		throw new Error("Artifact images must use an absolute http(s) URL.");
	}
	// MDX image dimensions are author-controlled remote content in v1.
	return (
		// biome-ignore lint/performance/noImgElement: remote Artifact images do not have known dimensions
		<img
			{...props}
			alt={props.alt ?? ""}
			className="my-6 max-w-full rounded-lg"
		/>
	);
};

export const visualComponents = {
	Callout,
	Checklist,
	Comparison,
	FileTree,
	Mermaid,
	Stat,
	StatGrid,
	Step,
	Steps,
	Timeline,
	TimelineItem,
	img: ExternalImage,
};
