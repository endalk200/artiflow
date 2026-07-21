# Artiflow telemetry

Artiflow exports traces and structured logs from both the Next.js server and
the CLI over OTLP/HTTP protobuf. Telemetry is enabled by default and targets a
local OpenTelemetry collector at `http://127.0.0.1:4318`.

## Configuration

Set the standard OpenTelemetry base endpoint for either executable:

```dotenv
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

Artiflow appends the OTLP signal paths to the base URL:

- traces: `/v1/traces`
- logs: `/v1/logs`

Signal-specific variables take precedence and are interpreted as complete
URLs; Artiflow does not append a path to them:

```dotenv
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://collector.example.com/otel/v1/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://collector.example.com/otel/v1/logs
```

Only absolute `http://` and `https://` endpoints are accepted. The web server
fails during instrumentation registration when its endpoint is invalid. The
CLI prints a warning, disables telemetry for that invocation, and continues
running so telemetry cannot break a user command.

Set `OTEL_SDK_DISABLED=true` to disable both signals. Operators may override
the executable's service name with `OTEL_SERVICE_NAME`; keeping the defaults is
recommended so the two services remain distinguishable.

## Service identity

| Executable | `service.name` | `service.namespace` |
| --- | --- | --- |
| Next.js server | `artiflow-web` | `artiflow` |
| CLI | `artiflow-cli` | `artiflow` |

The CLI also reports its installed version as `service.version`.

## What is instrumented

The web server registers OpenTelemetry through Next.js's root
`instrumentation.ts` entry point. This preserves Next.js request, route,
render, and fetch spans. Effect uses the registered global providers, and both
server actions/pages and the Effect HTTP API explicitly continue the active
Next.js span before recording domain and SQL work.

The CLI owns a scoped Effect telemetry layer. It records an `artiflow.cli`
span, Effect HTTP client spans, and structured logs. The scoped layer batches
and flushes pending telemetry when the CLI exits. Final export is bounded to
500 milliseconds so a missing or hanging collector does not stall commands.

Stable domain spans include project and artifact create, read, list, rename,
delete, revision, and source-validation operations. Effect SQL and HTTP client
instrumentation provide the lower-level database and outbound-request spans.

## Attributes, logs, and privacy

Artiflow records stable operation fields such as command name, project or
artifact identifier, revision number, source-format version, and bounded
operation outcomes. Mutation logs are emitted inside their domain spans, so
the exporter attaches the corresponding trace and span identifiers.

Artiflow's custom spans and logs intentionally do not add raw CLI arguments,
source paths, source content, project or artifact names, idempotency keys,
database URLs, authorization values, cookies, request bodies, full header maps,
or raw query strings. Identifiers are never used in span names.

Next.js and Effect also emit their standard HTTP telemetry. Effect HTTP spans
include URL and header attributes with built-in sensitive-header redaction, so
secrets must not be placed in URLs or non-standard headers. Apply an additional
collector redaction processor when deployment-specific headers or query fields
can contain sensitive data.

## Local collector check

Run an OpenTelemetry collector with OTLP/HTTP enabled on port `4318`, then
exercise both executables. A CLI request to the web API should produce a trace
tree similar to:

```text
artiflow.cli
  -> http.client POST
    -> Next.js request/route
      -> artiflow.artifact.create
        -> sql.execute
```

If the collector is unavailable, exporters fail independently of application
work. Web requests and CLI command results continue to use their normal error
and exit behavior.
