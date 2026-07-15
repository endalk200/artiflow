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
