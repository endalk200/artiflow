---
name: source-context
description: Use when working with Effect code. Resolve version-matched dependency source with opensrc before relying on memory, docs summaries, or generated examples.
---

## Purpose

Use version-matched dependency source as the authority for Effect v4 beta and AI SDK behavior.

Training data and public examples may be stale. Before changing, debugging, or explaining code that depends on these packages, inspect the installed-version source, tests, and bundled docs where available.

For anything beyond a quick one-file lookup, prefer running this work in a dedicated subagent.

Use a dedicated subagent by default when you need to:

- Inspect multiple files
- Trace call paths across a library
- Compare runtime code and tests
- Verify edge-case behavior
- Investigate version-specific behavior
- Summarize findings without dumping raw source into the main thread

Have the subagent:

1. Resolve the correct source tree with `opensrc path ...`
2. Inspect the fetched code with normal search and read tools
3. Return only the relevant files, symbols, and conclusions

Prompt the subagent with the full target and question, including any version or cwd constraints.

## Packages Covered

- `effect`

## Required Workflow

1. Identify the workspace package that owns the code being changed.
   Use the nearest `package.json` that declares the dependency.

2. Resolve source paths with `opensrc` from that package directory:

   ```sh
   opensrc path --cwd <workspace-package-dir> effect @effect/platform-node ai @ai-sdk/devtools
   ```

   Do not hardcode versions or cache paths in this skill.

3. If only one dependency is relevant, resolve only that package:

   ```sh
   opensrc path --cwd <workspace-package-dir> effect
   ```

4. Search and inspect the resolved source with the agent's available code search and file-reading tools.
   Prefer source, tests, examples, and bundled docs over memory.

5. When making a recommendation or code change, ground it in what was found.
   Reference the dependency file or test that supports the behavior when useful.

## Usage Examples

Resolve all covered packages for code owned by `apps/cli`:

```sh
opensrc path --cwd apps/web effect @effect
```

Resolve and search one package:

```sh
effect_src="$(opensrc path --cwd apps/cli effect)"
# Search for the relevant symbol or behavior inside "$effect_src".
```

Fetch a specific version only when package-local lockfile resolution is unavailable or intentionally bypassed:

```sh
opensrc path effect@4.0.0-beta.67
```

## Important Notes

- Do not run `opensrc path --cwd` from the repo root unless the root package declares the dependency. In a monorepo, the root may resolve the wrong version.
- If `opensrc` fetches on cache miss and network access is blocked, request approval rather than guessing.
- If source and local package types disagree with public docs, trust the installed-version source/types.
- For AI SDK feature work, also use the `ai-sdk` skill. This skill provides source verification; the `ai-sdk` skill provides API-specific workflow guidance.

## When to Use

Use it when you need to:

- Modify code importing these packages
- Debug runtime or type behavior involving these packages
- Understand behavior that docs or types do not explain
- Understand APIs, layers, services, runtime behavior, streams, tools, agents, or devtools
- Verify edge cases or beta-version behavior
- Recommend patterns based on real implementations

## When Not to Use

Do not fetch source for:

- Simple setup or installation questions
- Cases where local docs or types already answer the question
- Broad research that does not require implementation details
