## References

Check [./CONTEXT.md](./CONTEXT.md) for terminology questions.

When modifying, debugging, or explaining code that uses `effect` always use the `source-context` skill first to inspect version-matched dependency source. This is specially true for effect v4 APIs.

For AI SDK feature work, use both `source-context`

## Workflow

Whenever you make changes to the codebase run:

- `bun run format:write`
- `bun run check-types`
- `bun run lint`
- `bun run test`

## NOTES

- Before starting any work make sure you have good understanding of the goal or objective of the work.
- Don't stop until you have achieved the goal or objective of your work.
- Always verify your work before finishing.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `endalk200/artiflow`; external pull requests are not a triage request surface. See `docs/agents/issue-tracker.md`.

### Triage and Wayfinder labels

Canonical triage and Wayfinder roles map directly to identically named GitHub labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses a single-context domain documentation layout. See `docs/agents/domain.md`.
