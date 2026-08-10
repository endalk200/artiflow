# Services, Layers, And Modules

## Module Surface

Follow the existing codebase's module style. When there is no established convention, use a domain-named `Context.Service` class and keep its primary layers beside it.

```ts
export class NotFound extends Schema.TaggedErrorClass<NotFound>()(
  "UserRepo.NotFound",
  { id: UserId },
) {}

export class UserRepo extends Context.Service<UserRepo, {
  readonly get: (id: UserId) => Effect.Effect<User, NotFound | PersistenceError>
}>()("@app/UserRepo") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const get = Effect.fn("UserRepo.get")(function* (id: UserId) {
        // ...
      })

      return UserRepo.of({ get })
    }),
  )
}
```

Export the intentional service, error, and layer surface. Keep row codecs, local schemas, and implementation helpers private. Use ordinary ES modules and barrels for organization.

## Layer Constructors

Choose the layer constructor that matches the thing produced.

```ts
Layer.succeed(Service, impl)       // already-built service
Layer.sync(Service, () => impl)    // lazy synchronous service
Layer.effect(Service, makeEffect)  // effectful service acquisition
```

Guidance:

- Default real implementations to `Layer.effect(Service, Effect.gen(...))`.
- Use `Layer.effectContext(...)` when one acquisition intentionally supplies multiple services, especially first-class test stubs or one client backing several service tags.
- Use `Layer.unwrap(...)` when config or runtime discovery chooses/builds the layer.
- Use `Layer.fresh(...)` or `Effect.provide(layer, { local: true })` only when a test or operation needs isolated acquisition.
- Use `Context.Reference` rarely, only for ambient/defaultable runtime references where a safe default is real.

## Long-Lived Work

A layer that starts a stream, listener, worker, subscription, or forever loop must fork that work into the layer scope. Layer acquisition must complete.

```ts
export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const events = yield* Events

    yield* events.stream.pipe(
      Stream.runForEach(handleEvent),
      Effect.forkScoped,
    )
  }),
)
```

Guidance:

- Use `Effect.forkScoped`, `FiberSet`, or `FiberMap` for scoped background work.
- Fork long-lived work so layer acquisition can complete.
- Expose a public `start` method only when manual lifecycle control is part of the domain.

## Runtime Wiring

- Use `Layer.provide(...)` to hide an implementation dependency.
- Use `Layer.provideMerge(...)` only when the dependency should remain exposed for downstream consumers.
- Use `Layer.mergeAll(...)` for independent exposed layers.
- Prefer flat, topologically sorted runtime layer values with named subgraphs.
- Choose `provideMerge` from the intended exposed service graph.
- Keep authority and lifecycle dependencies visible in the layer topology.

## Effect.fn

Use extra `Effect.fn(...)` arguments for wrappers that apply to the whole function call. Each transform receives `(effect, ...originalArgs)`.

```ts
const readAttachment = Effect.fn("Attachment.read")(
  function* (ref: AttachmentRef) {
    return yield* api.read(ref)
  },
  (effect, ref) =>
    effect.pipe(
      attachmentError("Attachment.read", { attachmentId: ref.id }),
    ),
)
```

Good whole-function transforms:

- error classification
- localized recovery
- logging annotations
- spans
- retry
- timeout
- ensuring cleanup
- small local provisioning
- result mapping

Guidance:

- Keep the generator body focused on the core workflow.
- Use transforms when the wrapper needs original arguments.
- Keep transforms short; one or two whole-function concerns are usually enough.
- Handle local branches inside the workflow body.

## Operation Error Helpers

For boundary errors with operation labels, prefer a shared curried `mapError` helper over hand-writing wrappers in every module.

```ts
const persistenceError = operationError(PersistenceError.make)

const row = yield* query.pipe(
  persistenceError("UserRepository.findById"),
)
```

Name the local helper after the error it produces, such as `persistenceError`, `projectionError`, or `processingError`. Use `Effect.fn(...)` and spans for observability in addition to payload labels, not instead of them.
