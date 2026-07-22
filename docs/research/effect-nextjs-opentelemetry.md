# Effect and Next.js telemetry integration research

**Status:** implementation-ready recommendation

**Researched:** 2026-07-21

**Repository versions inspected:** Next.js 16.2.6, Effect 4.0.0-beta.98, `@effect/opentelemetry` 4.0.0-beta.98, `@vercel/otel` 2.1.2

## Executive recommendation

Use one standard, server-only environment variable for the default collector:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

Give the two executables distinct identities—`artiflow-web` and `artiflow-cli`—under the shared `service.namespace=artiflow`. Export both traces and logs over OTLP/HTTP protobuf. The standard base endpoint automatically resolves to `/v1/traces` and `/v1/logs`; signal-specific variables remain optional overrides and must contain the full signal URL. This follows the OpenTelemetry exporter environment-variable specification rather than introducing an Artiflow-only endpoint variable ([OTLP exporter configuration](https://opentelemetry.io/docs/specs/otel/protocol/exporter/), [OTLP HTTP request paths](https://opentelemetry.io/docs/specs/otlp/)).

The web and CLI should deliberately use different SDK composition:

- **Web:** initialize `@vercel/otel` from the root `instrumentation.ts`, including an OTLP log processor, then bridge Effect traces and logs into the globally registered providers. This preserves the request/render/fetch spans Next.js already creates and makes Effect business spans children of the active Next.js request span.
- **CLI:** use Effect's native `OtlpTracer` and `OtlpLogger` layers. This is a standalone Effect program, so the native layers provide the smallest direct route to OTLP, batching, failure isolation, and scoped shutdown flushing.

Do not create an independent `@effect/opentelemetry` `NodeSdk.layer` tracer provider inside the web application. Its provider is scoped but not registered globally, so Next.js automatic spans and Effect spans would be split across providers. The Effect global bridge is specifically designed to use the global OpenTelemetry provider and the currently active OpenTelemetry context ([Effect `NodeSdk`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/opentelemetry/src/NodeSdk.ts), [Effect `OtelTracer`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/opentelemetry/src/OtelTracer.ts)).

## Why this architecture fits Next.js

Next.js calls `register` in the root `instrumentation.ts` once per server instance and completes it before accepting requests. Its documentation recommends importing side-effectful or runtime-specific instrumentation from inside `register`, with conditional dynamic imports based on `process.env.NEXT_RUNTIME` ([instrumentation guide](https://nextjs.org/docs/app/guides/instrumentation), [instrumentation file convention](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)). Artiflow's server-side database and telemetry SDK integration are Node-specific, so registration should be dynamically imported only when `NEXT_RUNTIME === "nodejs"`.

Next.js already emits useful server traces, including request, route, render, and fetch activity. `@vercel/otel` is its documented setup for common cases and registers the global tracer provider, propagators, and context manager needed by those spans ([Next.js OpenTelemetry guide](https://nextjs.org/docs/app/guides/open-telemetry)). Artiflow should enrich that trace tree, not replace it.

The installed `@vercel/otel` also accepts `logRecordProcessors`, creates a global `LoggerProvider`, and shares the resource across tracing and logging. Its default trace exporter is OTLP/HTTP protobuf and respects the standard OpenTelemetry endpoint variables ([installed `@vercel/otel` SDK source](https://github.com/vercel/otel/blob/da8bfe8956c251dbf526c7c7d353a5eed7306b4c/packages/otel/src/sdk.ts), [configuration types](https://github.com/vercel/otel/blob/da8bfe8956c251dbf526c7c7d353a5eed7306b4c/packages/otel/src/types.ts)). Use explicit batch trace and log processors backed by the two resolved OTLP URLs so both signals share Artiflow's validated endpoint semantics.

Effect's `OtelTracer.layerGlobal` converts Effect spans to spans from the global OpenTelemetry provider. A fresh Effect root span is explicitly marked as a root, however, so an ambient Next.js OpenTelemetry span is not adopted automatically. Artiflow must capture the active OpenTelemetry `SpanContext` at each Effect runtime boundary and provide it through `OtelTracer.withSpanContext` or `Tracer.ParentSpan`. Effect-created spans then remain in the Next.js trace, and nested OpenTelemetry-aware clients retain the same context. Defects and failures become exception events and error status ([Effect `OtelTracer`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/opentelemetry/src/OtelTracer.ts)).

Effect's `OtelLogger` maps Effect log levels to OpenTelemetry severity and attaches trace/span identifiers through the active context. It can merge with the existing Effect console logger so local development remains readable if the collector is down ([Effect `OtelLogger`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/opentelemetry/src/OtelLogger.ts), [OpenTelemetry log correlation data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)). Build its provider service from `logs.getLoggerProvider()` after `registerOTel` has registered the provider globally.

### Web composition points

The web application currently has two independent Effect runtime roots. Both must receive the same bridge layer:

1. [`apps/web/server/runtime.ts`](../../apps/web/server/runtime.ts), used by pages and server actions.
2. [`apps/web/server/http/api-handler.ts`](../../apps/web/server/http/api-handler.ts), which creates its own runtime through `HttpRouter.toWebHandler`.

Providing telemetry only to `artiflowRuntime` would leave the HTTP API route uninstrumented. Keep the bridge at these production composition roots so unit and integration tests can continue to supply in-memory telemetry or no telemetry without opening a network connection.

Add [`apps/web/instrumentation.ts`](../../apps/web) at the application root and dynamically import a Node-only registration module from `register`. If `onRequestError` performs asynchronous export work, await it before returning; a direct OpenTelemetry logger emit is synchronous and the batch processor owns export. Next.js documents this hook for reporting uncaught server errors ([instrumentation `onRequestError`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)). Log only stable fields such as route path template, route type, router kind, request method, and error digest—never request headers, raw query parameters, cookies, or bodies.

Do not turn on `NEXT_OTEL_VERBOSE=1` by default. It exposes additional internal spans and is useful for short diagnostic sessions, but normally produces avoidable volume. Also do not pre-emptively externalize every OpenTelemetry dependency in `next.config.ts`. Server dependencies are bundled unless listed in `serverExternalPackages`; add an exception only if the production build proves a Node package must remain external ([`serverExternalPackages`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)).

## Why the CLI should use Effect-native OTLP

The CLI is a standalone Effect application, not an application embedding an existing OpenTelemetry SDK. The version-matched Effect documentation and source provide direct OTLP layers under `effect/unstable/observability`. `OtlpTracer` batches spans, `OtlpLogger` batches logs, and the shared exporter flushes during scoped layer finalization. Export failures are handled as telemetry failures rather than application failures, including bounded retries for transient failures ([Effect `OtlpTracer`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/effect/src/unstable/observability/OtlpTracer.ts), [Effect `OtlpLogger`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/effect/src/unstable/observability/OtlpLogger.ts), [Effect `OtlpExporter`](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/effect/src/unstable/observability/OtlpExporter.ts)).

Use protobuf serialization and the existing Node fetch client. Provide the scoped observability layer around the whole CLI program before `NodeRuntime.runMain`; interruption and normal completion then release the scope and flush pending batches before process exit. Effect's Node runtime already handles `SIGINT` and `SIGTERM` by interrupting the main fiber ([Effect Node runtime](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/platform-node-shared/src/NodeRuntime.ts)). The shutdown should remain bounded so an unreachable collector cannot hang the CLI.

The endpoint resolver should implement this precedence:

```text
traces = OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
      ?? join(OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://127.0.0.1:4318", "/v1/traces")

logs  = OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
      ?? join(OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://127.0.0.1:4318", "/v1/logs")
```

Signal-specific endpoint values are used as-is; only the base endpoint receives the path suffix. Normalize a single trailing slash before joining. Honor `OTEL_SDK_DISABLED=true`, and support `OTEL_EXPORTER_OTLP_HEADERS`, per-signal headers, timeouts, and protocol settings where the selected Effect configuration API exposes them. `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` is the recommended explicit value. Do not perform an `OPTIONS` or collector health preflight: OTLP does not require one, a valid collector may reject it, and the exporter is already fail-open.

### Local Skopeo reference

The neighboring Skopeo CLI is useful evidence for the lifecycle seam:

- `/Users/endalk200/src/projects/bethel/skopeo/apps/cli/src/runtime/telemetry.ts`
- `/Users/endalk200/src/projects/bethel/skopeo/apps/cli/src/program.ts`
- `/Users/endalk200/src/projects/bethel/skopeo/apps/cli/src/cli/run.ts`
- `/Users/endalk200/src/projects/bethel/skopeo/packages/cli/config/src/index.ts`

It provides a scoped telemetry layer around the program and records service metadata. Do not copy its `SimpleSpanProcessor`, `SimpleLogRecordProcessor`, `OPTIONS` preflight, custom endpoint variable, or raw CLI-argument recording. The OpenTelemetry JavaScript exporter documentation recommends batching for production; simple processors export records individually and add avoidable latency ([OpenTelemetry JavaScript exporters](https://opentelemetry.io/docs/languages/js/exporters/)).

## Trace topology and propagation

The desired end-to-end publish trace is:

```text
artiflow.cli.publish
  └─ http.client POST
      └─ Next.js request/route span
          └─ artiflow.artifact.create (or append_revision)
              └─ sql.execute
```

Effect's HTTP client already creates `http.client {METHOD}` spans, adds standard HTTP client attributes, redacts sensitive headers, and injects W3C trace context by default. The web SDK extracts that context, so CLI-to-web propagation requires no custom header code ([Effect HTTP client](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/effect/src/unstable/http/HttpClient.ts)).

Effect SQL already emits `sql.execute` and transaction spans. PostgreSQL enriches them with `db.system.name=postgresql`, database namespace, and server address/port. Artiflow should add domain spans around use cases, not duplicate every database statement ([Effect SQL statements](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/effect/src/unstable/sql/Statement.ts), [Effect PostgreSQL client](https://github.com/Effect-TS/effect-smol/blob/3e4abbcb0d0e9a5e82b6b88c7ef7ab69900105ec/packages/sql/pg/src/PgClient.ts)).

## Span and attribute design

Span names must describe a bounded operation, never instance data. HTTP semantic conventions require low-cardinality route templates rather than raw URI paths, and the general conventions apply the same principle to custom span names ([HTTP span conventions](https://opentelemetry.io/docs/specs/semconv/http/http-spans/), [semantic-convention guidance](https://opentelemetry.io/docs/specs/semconv/how-to-write-conventions/)).

Recommended business spans:

```text
artiflow.project.create
artiflow.project.get
artiflow.project.list
artiflow.project.rename
artiflow.project.delete
artiflow.artifact.create
artiflow.artifact.get
artiflow.artifact.list
artiflow.artifact.append_revision
artiflow.artifact.get_revision
artiflow.artifact.delete
artiflow.artifact.validate_source
artiflow.cli.<command>
```

The CLI root span should use the known command catalog, such as `artiflow.cli.project.create`, and also store that catalog value in `artiflow.cli.command.name`. A command name may be used in the span name or as an attribute only after parsing it against the finite command catalog. Positional values include source paths, project names, and identifiers, so raw arguments and names derived from them must not be recorded.

Recommended custom attributes, added only where useful:

```text
artiflow.project.id
artiflow.artifact.id
artiflow.revision.id
artiflow.revision.number
artiflow.source_format.version
artiflow.operation.outcome        # created, replayed, conflict, not_found
artiflow.cli.command.name
```

Resource attributes:

```text
service.name = artiflow-web | artiflow-cli
service.namespace = artiflow
service.version = <deployed app or CLI version>
deployment.environment.name = <optional environment name>
```

`service.name` identifies the executable, `service.namespace` groups related services, and `service.version` distinguishes deployments ([service resource conventions](https://opentelemetry.io/docs/specs/semconv/resource/service/), [resource conventions](https://opentelemetry.io/docs/specs/semconv/resource/)). Keep custom names in the `artiflow.*` namespace and do not reuse OpenTelemetry-reserved namespaces with altered meanings ([attribute naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)).

Identifiers are high-cardinality but can be valuable as span attributes for targeted debugging; they must never be span names or metric labels. Apply them selectively. Artiflow's custom spans and logs must not add:

- artifact source or request/response bodies;
- project or artifact titles/names;
- source file paths or raw CLI arguments;
- database connection strings;
- idempotency keys;
- cookies, authorization values, complete header maps, or raw query strings.

OpenTelemetry explicitly allows privacy, security, and performance considerations to make attributes opt-in rather than universally captured ([attribute requirement levels](https://opentelemetry.io/docs/specs/semconv/general/attribute-requirement-level/)).

Effect's standard HTTP instrumentation independently records URL and header semantic-convention attributes with its built-in sensitive-header redaction. Do not put secrets in URLs or non-standard headers, and add collector-side redaction for deployment-specific sensitive fields. The custom telemetry policy above cannot erase attributes emitted by upstream automatic instrumentation.

## Logging policy

Use stable human-readable messages plus structured `Effect.annotateLogs` fields. The logger bridge will attach `traceId` and `spanId` to records emitted within a span, allowing trace-log correlation without placing identifiers in the message body ([OpenTelemetry logs model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)).

Recommended levels:

- `Info`: mutation success, CLI command started/completed, and significant state transitions.
- `Warning`: expected conflicts, not-found outcomes when operationally useful, recoverable validation failures.
- `Error`: unexpected infrastructure or invariant failures; attach a sanitized cause, not an entire request object.

Avoid a log for every repository read when the trace already captures it. Log state-changing or operationally meaningful events. Keep the existing console logger merged in the web process for development and collector outages. In the CLI, preserve stdout as the user-facing command result channel; telemetry logging must not alter the command's stdout contract.

`@opentelemetry/api-logs` does not automatically capture arbitrary `console.*` output. This design intentionally exports Effect logs and explicit `onRequestError` records. Next.js internal console output remains local unless a separate, consciously scoped console-log bridge is added later ([OpenTelemetry logs specification](https://opentelemetry.io/docs/specs/otel/logs/)).

## Configuration example

Recommended `.env.example` documentation:

```dotenv
# Server-only OTLP/HTTP base endpoint. The SDK appends /v1/traces and /v1/logs.
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf

# Optional full-URL per-signal overrides.
# OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces
# OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://127.0.0.1:4318/v1/logs

# Optional kill switch.
# OTEL_SDK_DISABLED=true
```

Do not prefix any of these with `NEXT_PUBLIC_`; the collector target and headers are server configuration. The current web example contains a generic `OTEL_SERVICE_NAME=artiflow` and separate signal endpoints on port 27686. Replace the endpoint defaults with the base variable above. Prefer code-owned executable service names so the web and CLI are distinguishable; retain `OTEL_SERVICE_NAME` only if operators intentionally need to override those identities.

## Verification plan

### Automated tests

1. Unit-test endpoint precedence, path joining, trailing slashes, invalid URLs, the default `127.0.0.1:4318`, and `OTEL_SDK_DISABLED`.
2. Use in-memory OpenTelemetry span and log exporters for the web bridge. Assert Effect spans parent to an active global OpenTelemetry span and Effect logs contain matching trace/span IDs and annotations.
3. Use a local fake OTLP HTTP server for the CLI. Assert requests reach `/v1/traces` and `/v1/logs`, resource attributes identify `artiflow-cli`, severities map correctly, and shutdown flushes the final batch.
4. Assert exported payloads never contain raw CLI arguments, source paths, source content, project/artifact names, authorization headers, or database URLs.
5. Assert an unreachable collector does not change HTTP responses, server-action results, CLI exit status, or CLI stdout, and does not delay shutdown beyond the configured timeout.
6. Run a production Next.js build to validate Node-only dynamic imports and bundling. Add `serverExternalPackages` entries only in response to a demonstrated build/runtime issue.

### End-to-end collector check

With a collector on `127.0.0.1:4318`, exercise a page request, server action, HTTP API request, and CLI publish. Verify:

- a CLI trace connects the CLI root, Effect HTTP client, Next.js request, Artiflow use-case, and SQL spans;
- web-only requests show a Next.js root with Effect use-case and SQL children;
- Effect logs inside those operations share trace and span identifiers;
- service/resource attributes separate `artiflow-web` from `artiflow-cli` while grouping both under `artiflow`;
- span names stay bounded when source paths, IDs, project names, and URLs vary;
- collector unavailability is observable locally but never becomes an application failure.

After implementation, run the repository-required validation suite:

```sh
bun run format:write
bun run check-types
bun run lint
bun run test
```

## Implementation checklist

- Add root `apps/web/instrumentation.ts` with Node-only dynamic registration.
- Register `@vercel/otel` tracing plus a batch OTLP log processor.
- Build an Effect global tracer/logger bridge and supply it to both web runtime roots.
- Add sanitized, awaited `onRequestError` reporting if uncaught Next.js errors must be exported.
- Build a shared, tested OTLP environment resolver with the localhost default and standard precedence.
- Add Effect-native batched OTLP tracing/logging to the scoped CLI runtime.
- Replace raw CLI argument/span-name capture with the parsed command catalog.
- Add stable business spans and structured, privacy-reviewed attributes/logs.
- Update `.env.example` and deployment documentation.
- Execute the automated and collector-backed verification plan.
