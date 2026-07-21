import { InvalidArtifactSource } from "@app/api-contract/models";
import { compileMDX, parseFrontmatter } from "@fumadocs/mdx-remote";
import { Effect } from "effect";
import { JSDOM } from "jsdom";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import { visualComponents } from "../../components/artifact/visual-components";

export type ValidatedArtifactSource = {
	readonly description?: string;
	readonly source: string;
	readonly title: string;
};

const sourceError = (code: string, message: string, line?: number) =>
	new InvalidArtifactSource({
		diagnostics: [{ code, message, ...(line === undefined ? {} : { line }) }],
	});

const frontmatterOf = (
	source: string,
): Effect.Effect<Record<string, unknown>, InvalidArtifactSource> =>
	Effect.try({
		try: () => {
			const frontmatter = parseFrontmatter(source).frontmatter;
			return typeof frontmatter === "object" && frontmatter !== null
				? (frontmatter as Record<string, unknown>)
				: {};
		},
		catch: (cause) =>
			sourceError(
				"invalid_frontmatter",
				cause instanceof Error
					? cause.message
					: "Could not parse Artifact frontmatter.",
			),
	});

const validateFrontmatter = (
	frontmatter: Record<string, unknown>,
): Effect.Effect<
	{ readonly description?: string; readonly title: string },
	InvalidArtifactSource
> => {
	if (
		typeof frontmatter.title !== "string" ||
		frontmatter.title.trim().length === 0
	) {
		return Effect.fail(
			sourceError(
				"missing_title",
				"Frontmatter must contain a non-empty title.",
			),
		);
	}
	const title = frontmatter.title.trim();
	if (title.length > 200) {
		return Effect.fail(
			sourceError(
				"invalid_title",
				"Artifact title must not exceed 200 characters.",
			),
		);
	}
	if (
		frontmatter.description !== undefined &&
		typeof frontmatter.description !== "string"
	) {
		return Effect.fail(
			sourceError(
				"invalid_description",
				"Frontmatter description must be a string when present.",
			),
		);
	}
	const description = frontmatter.description?.trim();
	if (description !== undefined && description.length > 500) {
		return Effect.fail(
			sourceError(
				"invalid_description",
				"Artifact description must not exceed 500 characters.",
			),
		);
	}
	return Effect.succeed({ ...(description ? { description } : {}), title });
};

const validateUnsupportedSyntax = (source: string) => {
	const lines = source.split("\n");
	let fence: "```" | "~~~" | undefined;
	const index = lines.findIndex((line) => {
		if (line.startsWith("```") || line.startsWith("~~~")) {
			const marker = line.slice(0, 3) as "```" | "~~~";
			fence = fence === marker ? undefined : marker;
			return false;
		}
		return fence === undefined && /^(?:import|export)\s/.test(line);
	});
	return index === -1
		? Effect.void
		: Effect.fail(
				sourceError(
					"unsupported_module_syntax",
					"Imports and exports are not supported in Artifact Source Format 1.",
					index + 1,
				),
			);
};

type Mermaid = typeof import("mermaid")["default"];

let mermaidPromise: Promise<Mermaid> | undefined;

const loadMermaid = () => {
	if (mermaidPromise !== undefined) return mermaidPromise;

	mermaidPromise = (async () => {
		const dom = new JSDOM("");
		const globalScope = globalThis as typeof globalThis & {
			document?: Document;
			window?: Window & typeof globalThis;
		};
		const previousDocument = globalScope.document;
		const previousWindow = globalScope.window;

		// Mermaid initializes DOMPurify when its module loads, including for parse-only use.
		globalScope.window = dom.window as unknown as Window & typeof globalThis;
		globalScope.document = dom.window.document;
		try {
			return (await import("mermaid")).default;
		} finally {
			if (previousWindow === undefined) {
				Reflect.deleteProperty(globalScope, "window");
			} else {
				globalScope.window = previousWindow;
			}
			if (previousDocument === undefined) {
				Reflect.deleteProperty(globalScope, "document");
			} else {
				globalScope.document = previousDocument;
			}
			dom.window.close();
		}
	})();

	return mermaidPromise;
};

const SmokeMermaid = async ({
	chart,
	children,
}: {
	readonly chart?: string;
	readonly children?: ReactNode;
}) => {
	const diagram = chart ?? (typeof children === "string" ? children : "");
	const mermaid = await loadMermaid();
	await mermaid.parse(diagram);
	return null;
};

const smokeComponents = {
	...visualComponents,
	Mermaid: SmokeMermaid,
};

const executeComponentTree = async (node: ReactNode): Promise<void> => {
	if (Array.isArray(node)) {
		for (const child of node) await executeComponentTree(child);
		return;
	}
	if (!isValidElement(node)) return;

	const element = node as ReactElement<{ readonly children?: ReactNode }>;
	if (typeof element.type === "function") {
		const component = element.type as unknown as (
			props: typeof element.props,
		) => ReactNode | Promise<ReactNode>;
		if (
			"artiflowSmokeOpaque" in component &&
			(
				component as typeof component & {
					readonly artiflowSmokeOpaque?: boolean;
				}
			).artiflowSmokeOpaque === true
		) {
			return;
		}
		const rendered = await component(element.props);
		await executeComponentTree(rendered);
		return;
	}
	await executeComponentTree(element.props.children);
};

const smokeRender = (
	source: string,
): Effect.Effect<void, InvalidArtifactSource> =>
	Effect.tryPromise({
		try: async () => {
			const compiled = await compileMDX({
				components: smokeComponents,
				mdxOptions: {
					preset: "fumadocs",
					remarkImageOptions: false,
				},
				source,
			});
			const content = await compiled.body({ components: smokeComponents });
			await executeComponentTree(content);
		},
		catch: (cause) => {
			const position =
				typeof cause === "object" && cause !== null && "line" in cause
					? Number((cause as { readonly line?: unknown }).line)
					: undefined;
			return sourceError(
				"render_failed",
				cause instanceof Error
					? cause.message
					: "Artifact Source could not be rendered.",
				Number.isFinite(position) ? position : undefined,
			);
		},
	});

export const validateArtifactSource = (
	source: string,
): Effect.Effect<ValidatedArtifactSource, InvalidArtifactSource> =>
	Effect.gen(function* () {
		if (source.trim().length === 0) {
			return yield* sourceError(
				"empty_source",
				"Artifact Source must not be empty.",
			);
		}
		yield* validateUnsupportedSyntax(source);
		const frontmatter = yield* frontmatterOf(source);
		const metadata = yield* validateFrontmatter(frontmatter);
		yield* smokeRender(source);
		return { ...metadata, source };
	}).pipe(Effect.withSpan("artiflow.artifact.validate_source"));
