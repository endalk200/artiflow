# Caching, Memoization, And Request Dedupe

Prefer `effect/Cache` over a `Map` + timestamp + prune-loop cache when its keyed memoization, TTL, capacity, lifecycle, and eviction semantics fit.

## Core Rules

- `Cache.make({ capacity, lookup, timeToLive })` caches per-key lookups with one fixed TTL for all entries.
- `Cache.makeWith(lookup, { capacity, timeToLive(exit, key) })` computes TTL per entry from the lookup's `Exit` — the tool for "cache successes, not failures".
- Concurrent `Cache.get` calls for the same missing key share one pending lookup.
- `capacity` is required and bounds the cache.
- Return a zero TTL (`0` or `"0 millis"`) from `timeToLive` to avoid caching transient failures or degraded fallbacks without failing the caller. A short negative-cache TTL can be appropriate for stable failures such as not-found results.
- `Cache.invalidate(cache, key)` / `Cache.refresh(cache, key)` handle explicit staleness; `Cache.has` checks without triggering a lookup.
- Cache construction is effectful. Build the cache once in the owning layer or scope and share the handle; by default, lookup services are captured at construction. Use `requireServicesAt: "lookup"` only when callers should provide them per lookup.
- For a single value, build and share the cached effect returned by `Effect.cached(effect)` or `Effect.cachedWithTTL(effect, ttl)`:

```ts
const cached = yield* Effect.cachedWithTTL(expensiveLookup, "5 minutes")
const value = yield* cached
```

- For cached resources that need cleanup (connections, clients), use `ScopedCache`.

## Exit-Aware TTL (cache successes, skip degraded results)

```ts
import { Cache, Duration, Effect, Exit } from "effect"

const makeResolver = Effect.gen(function* () {
  const cache = yield* Cache.makeWith(
    (channelRef: string) => resolveUncached(channelRef), // never-failing, returns { where, cacheable }
    {
      capacity: 300,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) && exit.value.cacheable ? "10 minutes" : Duration.zero,
    },
  )
  return (channelRef: string) =>
    Cache.get(cache, channelRef).pipe(Effect.map((resolved) => resolved.where))
})
```

This replaces a hand-rolled `Map<string, { value, expiresAtMs }>` plus prune logic, and upgrades it: repeated rows pointing at the same key during one burst share a single provider call.

## Expensive Client Acquisition Belongs In The Layer, Not The Lookup

A cache cannot fix a lookup that pays a scoped acquisition per call, such as SDK client construction or authentication. Acquire clients once via the owning layer (`Layer.build` inside a `Layer.unwrap(Effect.gen(...))` composition, or a service dependency) so the cached lookup is a plain call:

```ts
// Bad: every cache miss acquires a fresh client
const lookup = (id: string) =>
  getRecord(id).pipe(Effect.provide(apiClientLayer(options)))

// Good: client built once for the layer's lifetime; misses are one API call
// Layer.build requires Scope.Scope; acquire this inside the owning layer's scope.
const context = yield* Layer.build(apiClientLayer(options))
const lookup = (id: string) => Context.get(context, ApiClient).getRecord(id)
```

## Request Batching (`Effect.request` + `RequestResolver`)

Batching exists for backends with a real batch endpoint: the resolver receives an array of pending requests and can collapse them into one wire call.

- Use it when the API can answer N keys in one call (SQL `IN (...)`, DataLoader-style endpoints, batch GET).
- Do not reach for it when the backend only has per-item endpoints (most REST provider APIs): a batched resolver still loops one call per entry, so it buys nothing over `Effect.forEach(items, f, { concurrency })` plus `Cache` for dedupe/memoization.
- `RequestResolver.batchN(resolver, n)` bounds batch size; `RequestResolver.makeGrouped` groups requests that must resolve through different targets.

Selection guide:

- Same key requested repeatedly over time → `Cache`.
- Same key requested concurrently in one burst → `Cache` (shared pending lookup).
- Many distinct keys, backend has a batch endpoint → `Effect.request` + `RequestResolver`.
- Many distinct keys, per-item endpoint only → `Effect.forEach(..., { concurrency: n })`, optionally through a `Cache`.

## Selection Guardrails

- Use `Cache` instead of custom Map/TTL/prune, in-flight dedupe, or LRU logic when its lifecycle fits.
- Choose failure TTLs by semantics. Skip transient failures and degraded fallbacks by default; bounded negative caching can protect an upstream from repeated stable failures.
- Hoist cache construction to the owning layer.
- Use `RequestResolver` batching only for a real batch backend.
- Acquire scoped clients in the owning layer before constructing the lookup.
