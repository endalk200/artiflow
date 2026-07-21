# Visual Components

Source Format 1 injects this catalog into Artifact Source MDX. Use standard Markdown for ordinary prose and reach for a component only when its visual form improves comprehension.

## Selection guide

| Information shape | Component | Use it for |
| --- | --- | --- |
| Emphasis | `Callout` | A decision, note, success, warning, or important constraint |
| Ordered procedure | `Steps` and `Step` | Actions that must be followed in sequence |
| Directory hierarchy | `FileTree` | A compact, monospaced file or folder tree |
| Relationships or flow | `Mermaid` | Architecture, state, dependency, and process diagrams |
| Chronology | `Timeline` and `TimelineItem` | Events, milestones, revisions, and phased change |
| Two peers | `Comparison` | Alternatives, before/after states, or tradeoffs |
| Completion state | `Checklist` | Done and remaining tasks |
| Key measures | `StatGrid` and `Stat` | A small set of headline values with context |

Use component names and props with the exact casing shown below. Components may contain Markdown unless their API says otherwise.

## Callout

```mdx
<Callout title="Decision" type="success">
  Publish the validated design.
</Callout>
```

Props:

- `title?: string` — optional heading.
- `type?: "info" | "note" | "success" | "warning"` — visual tone; defaults to `note`.
- `children` — body content.

Choose `info` for neutral context, `note` for supporting detail, `success` for a positive result, and `warning` for risk or required attention.

## Steps

```mdx
<Steps>
  <Step title="Author">Create one self-contained Artifact Source.</Step>
  <Step title="Publish">Validate it and create an immutable Revision.</Step>
</Steps>
```

`Steps` accepts `Step` children. Each `Step` accepts an optional `title?: string` and body content. Use it for a prescribed sequence; use `Timeline` when describing events rather than instructions.

## FileTree

```mdx
<FileTree>{`apps/
  web/
  cli/
packages/
  api-contract/`}</FileTree>
```

`FileTree` accepts plain-text children and preserves their spacing. Use a template literal, as shown, for predictable newlines and indentation.

## Mermaid

```mdx
<Mermaid chart={`flowchart LR
  Agent --> CLI
  CLI --> Artiflow
  Artiflow --> Artifact`} />
```

Props:

- `chart?: string` — Mermaid source.
- `children?: string` — fallback Mermaid source when `chart` is absent.

Prefer the `chart` prop. Publication parses the diagram and reports invalid Mermaid syntax as an Artifact Source diagnostic. Keep node labels short and use the simplest diagram type that communicates the relationship.

## Timeline

```mdx
<Timeline>
  <TimelineItem title="Revision 1">Initial proposal</TimelineItem>
  <TimelineItem title="Revision 2">Validated implementation</TimelineItem>
</Timeline>
```

`Timeline` accepts `TimelineItem` children. Every `TimelineItem` requires `title: string` and accepts body content.

## Comparison

```mdx
<Comparison
  left={
    <>
      <h3>Before</h3>
      <p>Dense, linear output</p>
    </>
  }
  right={
    <>
      <h3>After</h3>
      <p>Visual, navigable Artifact</p>
    </>
  }
/>
```

Props:

- `left?: ReactNode` — left panel content.
- `right?: ReactNode` — right panel content.
- `children?: ReactNode` — direct two-column content when panel props are absent.

Prefer `left` and `right` for a balanced pair; providing either prop renders both bordered panels. Child mode places its direct children in the two-column grid without adding panels.

## Checklist

```mdx
<Checklist>

- [x] Contract defined
- [x] Source validated
- [ ] Artifact published

</Checklist>
```

`Checklist` accepts a Markdown task list as its children and presents it as a compact panel. Preserve the blank lines around the task list so MDX parses it as Markdown.

## StatGrid

```mdx
<StatGrid>
  <Stat label="Artifact" value="1" description="Stable identity" />
  <Stat label="Revisions" value="3" description="Immutable history" />
  <Stat label="Status" value="Ready" />
</StatGrid>
```

`StatGrid` accepts `Stat` children and lays them out responsively. `Stat` props:

- `label: string` — required measure name.
- `value: ReactNode` — required headline value.
- `description?: string` — optional context.

Keep values short enough to scan as headlines. Use a Markdown table when the reader needs rows of detailed values rather than a few key measures.

## Remote images

Markdown and MDX images are supported when `src` is an absolute `http://` or `https://` URL:

```mdx
![System overview](https://example.com/system-overview.png)
```

Always provide meaningful alt text. Artifact Source Format 1 rejects relative paths and non-HTTP image sources.
