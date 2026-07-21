---
name: artiflow
description: Publish a polished visual Artifact for the current plan, report, review, or explanation.
compatibility: Requires the Artiflow CLI and network access to the configured Artiflow server.
disable-model-invocation: true
---

# Artiflow

Publish one polished visual document for the user's current request. Publication is complete when the successful temporary Artifact Source is removed and the returned URL is open, or browser opening is unavailable and that limitation is reported.

## 1. Preflight

Run `artiflow project show --json` from the working directory. Continue when the nearest `.artiflow/project.json` resolves to a live Project; otherwise, report the command's diagnostic.

Choose the publication target:

- Default to a new Artifact with `artiflow publish <source> --json`.
- Use `artiflow publish <source> --artifact <artifact-id> --json` only when the user explicitly asks to revise that known Artifact.

Preflight is complete when the linked Project resolves and the publication target is unambiguous.

## 2. Author

Create one self-contained Source Format 1 MDX file under `.artiflow/tmp/` with a descriptive unique filename. Start with:

```mdx
---
title: A concise document title
description: One optional sentence that helps the Project index
---
```

Keep the title at or below 200 characters and the description at or below 500 characters. Top-level imports and exports are unsupported. Keep all content and presentation in this single file.

Use Markdown for the document's structure. Before using an image or a Visual Component, read [`references/visual-components.md`](references/visual-components.md) completely, then follow its exact API and source constraints. Prefer the smallest useful visual vocabulary and compose components around the document's actual information.

Authoring is complete when the MDX is self-contained, its claims answer the user's request, and every chosen visual has a clear communicative job.

## 3. Publish and repair

Run the selected `artiflow publish` command with `--json`.

When publication returns structured Artifact Source diagnostics, repair the same temporary file and retry. Make at most two repair attempts after the first publication attempt. Repair the reported source errors while keeping the target Artifact and the document's intended claims unchanged. After a revision conflict, retain the revision target and report the conflict.

Publication is complete when the command returns a successful JSON result. After the third failed attempt, retain the MDX file and report its path with the final diagnostics so the user has a debugging handle.

## 4. Complete

After successful publication:

1. Read `artifactId`, `revisionId`, `revisionNumber`, and `url` from the JSON result.
2. Remove the successful temporary MDX file.
3. Open `url` with the agent's browser capability when one is available.
4. Return the Artifact and Revision identifiers with the URL. When browser opening is unavailable, say so explicitly.

The run is complete when the user has the identifiers and URL, the URL has been opened when possible, and the successful temporary source no longer exists.

Project and Artifact deletion remain explicit user-run CLI operations.
