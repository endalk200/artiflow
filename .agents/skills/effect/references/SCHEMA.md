# Schema And Data Modeling

## Records

Choose the representation from the decoded value that the program needs:

| Representation | Decoded runtime value | TypeScript identity | Behavior |
| --- | --- | --- | --- |
| `Schema.Struct` | Plain object | Structural | Module-level functions |
| `Schema.Opaque` around a struct | The same plain object | Opaque name; add a brand for nominal separation | Static members only |
| Direct schema subclass | Whatever the base schema already decodes | Unchanged | Static members only |
| `Schema.Class` | Prototype-backed class instance | Structural unless branded | Static and instance members |

Use `Schema.Struct(...)` when the value is an ordinary structural record.

```ts
export const User = Schema.Struct({
  id: UserId,
  name: Schema.NonEmptyString,
  email: Schema.optionalKey(Schema.String),
})

export type User = typeof User.Type
```

The value-level `User` is the schema and the type-level `User` is an optional alias. Declaration merging with a same-name interface is also valid when the project prefers that style; the schema already exposes its decoded type through `.Type`.

Use `Schema.Opaque` when the runtime value should remain a plain object but the public TypeScript type should display as one named type.

```ts
export class Point extends Schema.Opaque<Point>()(
  Schema.Struct({
    x: Schema.Finite,
    y: Schema.Finite,
  }),
) {
  static readonly decode = Schema.decodeUnknownEffect(this)
}

const point = Point.make({ x: 1, y: 2 })
```

`Schema.Finite` accepts finite JavaScript numbers and rejects `NaN`, `Infinity`, and `-Infinity`.

Treat the class syntax as a thin type shell:

- Construct with `.make(...)`, not `new`.
- Keep behavior on the static side or in module-level functions.
- Add a nominal brand when two opaque schemas with the same fields must not be assignable to each other.
- Calling schema combinators such as `.annotate(...)` returns the wrapped struct representation, not another opaque class.

Subclass an existing schema directly when it only needs co-located static helpers.

```ts
export class UserName extends Schema.NonEmptyString {
  static readonly decode = Schema.decodeUnknownEffect(this)
}
```

Direct schema subclassing preserves the decoded type and the base schema's static helpers, including `.make(...)`. It does not add nominal identity, prototype-backed values, instance methods, or a `new` constructor.

Use `Schema.Class` when decoding must produce a real class instance or domain behavior belongs on each instance.

```ts
export class Point extends Schema.Class<Point>("Geometry/Point")({
  x: Schema.Finite,
  y: Schema.Finite,
}) {
  static readonly origin = new Point({ x: 0, y: 0 })

  invert() {
    return new Point({ x: this.y, y: this.x })
  }
}
```

Class schemas:

- support `new`, `.make(...)`, static members, instance methods, getters, setters, and custom constructors
- decode a plain field structure through a transformation that produces a class instance
- preserve the prototype, so `instanceof` and instance methods work
- provide structural comparison through `Equal.equals`
- combine the runtime schema value and TypeScript type under one class symbol

### Class Structural-Typing Footgun

TypeScript can accept a plain object where an unbranded class type is expected when their visible fields match. The class schema still requires a class instance on its decoded side.

```ts
export class Point extends Schema.Class<Point>("Geometry/Point")({
  x: Schema.Finite,
  y: Schema.Finite,
}) {}

// This can type-check structurally, but it is not a Point instance.
const unsafe: Effect.Effect<Point> = Effect.succeed({ x: 0, y: 0 })

const safe: Effect.Effect<Point> = Effect.succeed(new Point({ x: 0, y: 0 }))
```

This mismatch is especially dangerous in `HttpApi`, RPC, and other schema-driven handlers: the response type may compile while runtime encoding rejects it because it never passed through the class transformation.

Add the class API's nominal brand type parameter when plain structural substitution would be unsafe. The brand is a TypeScript-only unique-symbol property declared with the class; Effect cannot synthesize that declaration-site identity as a runtime default. The string identifier is runtime schema metadata and is not a substitute for the brand. Check the project-pinned v4 signature because this API is still evolving.

Prefer a branded class for HTTP/RPC payloads and successes, persisted domain entities, and any API that requires actual instances. An unbranded class can fit local code where every value is constructed or decoded immediately and structural substitution is harmless.

### Selection Rules

- Pick `Schema.Struct` for DTOs, wire shapes, storage rows, and behavior-free records.
- Pick `Schema.Opaque` for a named plain-object type with `.make(...)` and optional static helpers.
- Subclass an existing schema directly to add static helpers without changing its decoded type.
- Pick `Schema.Class` for prototypes, `instanceof`, instance behavior, class construction, or class-aware structural comparison.
- Use `Schema.TaggedClass` when those class semantics are needed for a tagged variant; use `Schema.TaggedStruct` when a plain tagged object is enough.
- Keep domain behavior module-scoped for structs and opaque structs; co-locate it on instances only when that is the reason for choosing a class.

The identifier passed to `Schema.Class` supports runtime identity, diagnostics, schema metadata, and hot-reload/module-duplication behavior. Give it a stable, collision-resistant value such as a package-qualified name. It cannot provide TypeScript nominality because a string is not globally unique in a TypeScript program. When the Effect language server is configured, use its class snippet and identifier convention instead of retyping the ceremony.

General guidance:

- Add `.annotate({ identifier: "User" })` only when tooling consumes it: HTTP API, RPC, OpenAPI/JSON Schema, docs, diagnostics, or codegen.
- Decode unknown encoded input at boundaries with `Schema.decodeUnknownEffect(...)` by default.
- Use `schema.makeEffect(...)` for typed constructor input when type-side validation failure should stay in the Effect error channel.
- Use `schema.make(...)` for typed constructor input when construction is trusted or throwing is acceptable.
- Use `Schema.decodeUnknownSync(...)` only in scripts, tests, or startup paths where throwing is acceptable.
- Use `Schema.decodeUnknownOption(...)` only when mismatch details are intentionally discarded.
- Use `Schema.decodeUnknownResult(...)` for pure code that wants explicit success/failure without Effect.

## Field And Contract Reuse

Reuse fields directly when contracts are semantically related.

```ts
export const CreateUserInput = Schema.Struct({
  name: User.fields.name,
  email: User.fields.email,
})

export const StoredUser = User.pipe(
  Schema.fieldsAssign({
    createdAt: Schema.DateTimeUtcFromString,
  }),
)
```

Guidance:

- Use `.fields`, `Schema.fieldsAssign(...)`, and `.mapFields(...)` when contracts are genuinely related.
- Use `Schema.encodeKeys(...)` when decoded TypeScript names differ from encoded wire/storage keys and naming is the only difference.
- Keep explicit mapping when behavior, joins, validation, or domain translation is involved.
- Use `Schema.extendTo(...)` sparingly for decoded-only derived fields.
- Use field reuse to build small related contracts, not one oversized inheritance-by-schema object.

## Optionality And Defaults

- Use `Schema.optionalKey(...)` for absent JSON/storage keys.
- Use `Schema.optional(...)` only when explicit `undefined` is part of the contract.
- Use `Schema.NullOr`, `Schema.UndefinedOr`, or `Schema.NullishOr` only when nullish values are truly part of the encoded contract.
- Keep normalized defaulted values as required fields and apply defaults in constructors/decoding.
- Model domain optionality from the contract rather than construction convenience.

## Nominal Values

- Use constrained branded schemas for scalar IDs and value objects.
- Use normal schema constraints before `Schema.brand(...)` for most code.
- Reach for `Schema.fromBrand(...)` only when the project already models brands with `Brand` constructors or wants the check packaged with the brand constructor.

## Variants

```ts
type Step = Data.TaggedEnum<{
  Continue: { readonly cursor: number }
  Finished: { readonly count: number }
}>

export const Step = Data.taggedEnum<Step>()

const next = Step.Continue({ cursor: 10 })
const label = Step.$match(next, {
  Continue: ({ cursor }) => `continue at ${cursor}`,
  Finished: ({ count }) => `finished ${count}`,
})
```

```ts
export const Event = Schema.TaggedUnion({
  Started: { runId: RunId },
  Finished: { runId: RunId, result: Schema.Json },
})

export type Event = typeof Event.Type

const event = Event.cases.Started.make({ runId })
const label = Event.match(event, {
  Started: ({ runId }) => `started ${runId}`,
  Finished: ({ runId }) => `finished ${runId}`,
})
```

Guidance:

- Use `Data.TaggedEnum` for internal control-flow algebras that need constructors, `$is`, and exhaustive `$match`; reserve Schema variants for values that cross validation or encoding boundaries.
- Use `Schema.TaggedStruct` for the ordinary Effect-owned `_tag` variant.
- Use `Schema.TaggedUnion` when the union needs decoding, encoding, persistence, wire validation, JSON Schema derivation, or schema composition.
- Prefer a principled split over forcing one representation everywhere: Data internally, Schema at boundaries.
- Use `Schema.tag(...)` when an external contract has a custom discriminator field such as `type` or `kind`; combine those structs with `Schema.toTaggedUnion("type")` when union helpers are needed.
- If the encoded contract omits the discriminant, use `Schema.tagDefaultOmit(...)` deliberately.
- Choose `Schema.TaggedClass` only when the variant needs class-instance semantics; otherwise keep the lighter `Schema.TaggedStruct`.

## Errors

`Schema.TaggedErrorClass` is the explicit class exception for typed Effect errors.

```ts
export class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()(
  "UserRepo.PersistenceError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {}
```

Guidance:

- Map infrastructure failures into domain-specific tagged errors at service boundaries.
- Use instance getters to derive messages, status codes, or other diagnostics from stored error fields when that avoids redundant constructor data.
- Include operation labels when they help diagnose adapter, persistence, provider, or transport failures.
- Use schema unions for public API or transport error surfaces.
- Use `Schema.Defect()` for defect-like payloads.
- Preserve interruption when catching broad causes at ingress, worker, or stream boundaries.
