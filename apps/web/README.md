# Artiflow web

The Next.js application for Artiflow.

## Telemetry

The Node.js server exports Next.js and Effect traces plus structured Effect
logs using OTLP/HTTP protobuf. The default collector base URL is
`http://127.0.0.1:4318`; copy `.env.example` to `.env.local` to override it.

See [`docs/telemetry.md`](../../docs/telemetry.md) for configuration, signal
paths, service identities, and the instrumentation policy.
