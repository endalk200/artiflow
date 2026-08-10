# Out-of-Scope Knowledge Base

The `.out-of-scope/` directory stores persistent records of rejected feature requests. It provides:

1. **Institutional memory** — why a feature was rejected.
2. **Deduplication** — prior reasoning for similar future requests.

## Directory structure

```text
.out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── graphql-api.md
```

Use one file per **concept**, not per issue. Group multiple requests for the same concept in one record.

## File format

Write a short, readable design note rather than a database entry. Use enough explanation, examples, or code to make the reasoning durable.

```markdown
# Dark Mode

This project does not support dark mode or user-facing theming.

## Why this is out of scope

The rendering pipeline assumes a single palette resolved at build time.
Supporting runtime themes would introduce application-wide state and
persistence that do not align with the project's focus.

## Prior requests

- #42 — "Add dark mode support"
- #87 — "Night theme for accessibility"
```

### Naming

Use a short, recognizable kebab-case concept name such as `dark-mode.md` or `plugin-system.md`.

### Durable reasoning

Useful reasons refer to:

- project scope or philosophy;
- technical constraints;
- strategic decisions;
- architectural tradeoffs.

Temporary capacity such as "we are too busy right now" is a deferral, not an out-of-scope decision.

## When to check

During triage context gathering, read `.out-of-scope/*.md` and match the incoming request by concept rather than exact wording.

If a record looks relevant, show the maintainer the prior decision and ask whether it still holds. The maintainer may:

- **Confirm** — append the new request to the existing record and close it.
- **Reconsider** — delete or update the record and continue normal triage.
- **Distinguish** — explain why the requests differ and continue normal triage.

## When to write

Write or update a record only when an **enhancement** is rejected as `wontfix`. This includes rejected enhancement pull requests.

An already implemented request is not out of scope. Close it with a pointer to the existing behavior and leave the knowledge base unchanged.

The completed rejection flow is:

1. The maintainer decides the enhancement is out of scope.
2. Check for a matching concept record.
3. Append the request to an existing record or create a new one.
4. Post a comment explaining the decision and linking the record.
5. Close the tracker item with the configured `wontfix` role.

## Reconsidering a decision

When the maintainer changes their mind, remove or update the record. Historical issues can remain closed; the current request proceeds through normal triage.
