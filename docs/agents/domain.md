# Domain Docs

This repository uses a single-context domain documentation layout.

## Before Exploring

- Read the root `CONTEXT.md` for domain terminology.
- Read relevant ADRs under `docs/adr/` before changing an affected area.

If either location does not exist, proceed silently. Domain-aware skills create documentation only when terminology or decisions are actually resolved.

## Layout

- `CONTEXT.md`: repository-wide glossary and domain language
- `docs/adr/`: repository-wide architectural decisions

## Consumer Rules

Use terms as defined in `CONTEXT.md` in issue titles, proposals, tests, and code. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether it belongs to the domain or record the gap for `domain-modeling`.

If proposed work contradicts an ADR, surface the conflict explicitly instead of silently overriding the recorded decision.
