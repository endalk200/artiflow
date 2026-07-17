---
name: artiflow
description: Turn the current plan, report, review, or explanation into a visual Artiflow Artifact.
disable-model-invocation: true
---

# Artiflow

Publish one polished visual document for the user's current request. Publication is complete only when the returned URL is open and the successful temporary source is removed.

## 1. Preflight

Run `artiflow project show --json` from the working directory. Continue only when the nearest `.artiflow/project.json` resolves to a live Project. Report the command's diagnostic when it does not.

Decide whether this is a new Artifact or an explicit revision:

- Default to a new Artifact with `artiflow publish <source> --json`.
- Use `--artifact <artifact-id>` only when the user explicitly asks to revise that known Artifact.

## 2. Author

Create one self-contained Source Format 1 MDX file under `.artiflow/tmp/`. Use a descriptive unique filename. Start with:

```mdx
---
title: A concise document title
description: One optional sentence that helps the Project index
---
```

Use Markdown for document structure and the visual primitives below where they improve comprehension. The file may reference absolute `http://` or `https://` images. Keep all other content in this single file.

### Visual component API

`<Callout title="Decision" type="info|note|success|warning">...</Callout>`

`<Steps>` contains `<Step title="...">...</Step>` children.

`<FileTree>` contains a plain-text directory tree.

`<Mermaid chart={`graph TD; A-->B;`} />` or `<Mermaid>graph TD; A--&gt;B;</Mermaid>` shows a diagram.

`<Timeline>` contains `<TimelineItem title="...">...</TimelineItem>` children.

`<Comparison left={<>...</>} right={<>...</>} />` compares two peers; it may also wrap two child blocks.

`<Checklist>` wraps a Markdown task list.

`<StatGrid>` contains `<Stat label="..." value="..." description="..." />` children.

Compose primitives around the document's actual information. Use Mermaid for relationships or flows, Timeline for sequence, Comparison for meaningful alternatives, and Callout for decisions or risk.

## 3. Publish and repair

Run the selected `artiflow publish` command with `--json`. When it returns structured Artifact Source diagnostics, repair the same temporary file and retry. Make at most two repair attempts after the first publication attempt. Preserve the idempotent meaning of the document; do not switch an intended revision into a new Artifact after a conflict.

On final failure, retain the MDX file and report its path with the diagnostics. The retained file is the user's debugging handle.

## 4. Complete

On success:

1. Read `url` from the JSON response.
2. Remove the successful temporary MDX file.
3. Open `url` in Codex's browser surface.
4. Return the Artifact and Revision identifiers with the URL.

This skill publishes visual documents. It leaves Project and Artifact deletion to explicit user-run CLI commands.
