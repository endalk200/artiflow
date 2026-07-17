import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { validateArtifactSource } from "./source-validator";

describe("Artifact Source Format 1", () => {
	it.effect("smoke-renders the complete Visual Component catalog", () => {
		const source = `---
title: Visual catalog
description: Every Source Format 1 primitive
---

# Catalog

<Callout title="Decision" type="success">Proceed.</Callout>

<Steps><Step title="First">Plan.</Step><Step title="Second">Ship.</Step></Steps>

<FileTree>{\`apps/
  web/
  cli/\`}</FileTree>

<Mermaid chart={\`graph TD; A[Source]-->B[Artifact];\`} />

<Timeline><TimelineItem title="Now">Build.</TimelineItem></Timeline>

<Comparison left={<>Before</>} right={<>After</>} />

<Checklist>

- [x] Contract
- [ ] Release

</Checklist>

<StatGrid><Stat label="Revisions" value="2" description="Immutable" /></StatGrid>
`;

		return Effect.gen(function* () {
			const validated = yield* validateArtifactSource(source);
			assert.strictEqual(validated.title, "Visual catalog");
		}).pipe(Effect.timeout("10 seconds"));
	});

	it.effect("rejects module syntax with a line-addressed diagnostic", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				validateArtifactSource(
					"---\ntitle: Invalid\n---\n\nimport X from './local'",
				),
			);
			assert.strictEqual(
				error.diagnostics[0]?.code,
				"unsupported_module_syntax",
			);
			assert.strictEqual(error.diagnostics[0]?.line, 5);
		}),
	);

	it.effect("allows import and export examples inside code fences", () =>
		Effect.gen(function* () {
			const source =
				"---\ntitle: Code sample\n---\n\n```ts\nimport { Effect } from 'effect'\nexport const app = Effect.void\n```";
			const validated = yield* validateArtifactSource(source);
			assert.strictEqual(validated.title, "Code sample");
		}),
	);

	it.effect("rejects invalid Mermaid syntax during publication", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				validateArtifactSource(
					"---\ntitle: Invalid diagram\n---\n\n<Mermaid chart={`not a diagram ???`} />",
				),
			);
			assert.strictEqual(error.diagnostics[0]?.code, "render_failed");
		}),
	);
});
