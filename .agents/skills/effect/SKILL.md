---
name: effect
description: |
  Effect v4 implementation guidance. Use for Effect workflows, Schema models, services and Layers, Config, Schedule or retry, Cache, Stream, unstable HTTP, reactivity or Atom, and Effect tests. Resolve the project-pinned version before applying a branch.
license: MIT
compatibility: Requires Effect v4. See references/UPSTREAM.md for the exact audited versions.
---

# Effect

Work source-verified: project conventions and the project-pinned Effect source take precedence over this reference.

## Version Gate

Complete these in order:

1. Read the nearest `AGENTS.md` and any project-local Effect practices document; finish with the applicable conventions identified.
2. Resolve the installed `effect` version and inspect its exported source; finish with the definitions for every API the task will touch located.
3. Compare that version with `references/UPSTREAM.md`; finish with one authoritative snapshot selected, using `source-context` to resolve mismatches or missing source.
4. Read every matching branch below. Editing begins after all applicable references are loaded.

## Branch Chooser

- Data models, schemas, brands, variants, optional keys, or decoders: read `references/SCHEMA.md`.
- Services, layers, runtime wiring, errors, `Effect.fn`, or test services: read `references/SERVICES_LAYERS.md`.
- Runtime config, env variables, `ConfigProvider`, or `layerConfig`: read `references/CONFIG.md`.
- Retry, repeat, polling, backoff, jitter, rate-limit-aware policies, or pass loops: read `references/SCHEDULING.md`.
- Memoization, per-key TTL caches, deduplicating concurrent lookups, or request batching: read `references/CACHING.md`.
- Streams, event sources, async iterables, queues/pubsubs, pagination, backpressure, or stream consumers: read `references/STREAMS.md`.
- `effect/unstable/reactivity`, `@effect/atom-*`, `AsyncResult`, API-backed UI, frontend queries or mutations, atom runtimes, reactivity keys, optimistic updates, or stream-backed UI state: read `references/EFFECT_ATOM.md`.
- Outgoing HTTP calls, Effect HttpClient, status handling, or HTTP rate limiting: read `references/HTTP_CLIENTS.md`.
- Effect tests, time, sleeps, concurrency synchronization, or fakes: read `references/TESTING.md`.
- Maintaining this skill or its audited package pins: read `validation/README.md`.

## Cross-Cutting Defaults

- Compose inline workflows with `Effect.gen`; define reusable traced operation boundaries with `Effect.fn("Domain.operation")`.
- Use `Effect.fnUntraced` for reusable helpers whose stack-frame and span metadata are intentionally unnecessary.
- Keep expected failures typed and preserve defects and interruption for the owning supervision boundary.
- Decode unknown boundary input with `Schema.decodeUnknownEffect`; use `schema.makeEffect` for typed constructor input whose type-side validation can fail.
- Keep long-lived resources and background work scoped to the Layer or component that owns their lifetime.
- Retry only idempotent operations, at the narrowest boundary that can classify the failure truthfully.
- Preserve type information and solve Effect typing problems without unchecked casts or non-null assertions.

## Boundary Rules

- Keep HTTP handlers thin: decode input, read context, call services, map typed errors to transport responses.
- Place business rules in services or domain functions.
- Wrap HTTP clients, SDKs, CLIs, and external integrations in named effects at adapter boundaries.
- Decode persisted rows with Schema or SQL-specific helpers when values are not trivially trusted.
- Keep provider/network calls outside authoritative database transactions.
- Catch or retry only when the current boundary has a truthful response.
- Let exhausted failures remain visible unless the boundary has a real fallback.

## Completion Criterion

Before finishing:

- account for every Effect API introduced or changed against the project-pinned source
- apply every branch selected by the task
- run the narrowest relevant typecheck and tests
- leave no unchecked cast, swallowed interruption, unscoped long-lived work, or unbounded retry introduced by the change

The work is complete only when every item above is checkable and satisfied.
