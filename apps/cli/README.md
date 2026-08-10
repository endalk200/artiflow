# Artiflow CLI

The command-line interface for Artiflow.

## Install

```sh
npm install -g artiflow
artiflow --help
```

## Install the agent Skill

Install the explicit-only Artiflow Skill for the current codebase with the
[Skills CLI](https://skills.sh/):

```sh
npx skills add https://github.com/endalk200/artiflow
```

Install it globally for the current user instead:

```sh
npx skills add https://github.com/endalk200/artiflow --global
```

The Skills CLI discovers the Artiflow Skill from this repository and installs
it for the selected agents. Project scope is the default; `--global` makes the
Skill available across projects for the current user.

## Configuration

Artiflow connects to `http://localhost:3000` by default. Override the server for
one command or shell session with `ARTIFLOW_BASE_URL`:

```sh
ARTIFLOW_BASE_URL=https://artiflow.example.com artiflow project show
```

The CLI also reads `~/.artiflow/config.toml` when present:

```toml
base_url = "https://artiflow.example.com"
telemetry = false
```

Set `ARTIFLOW_CONFIG_PATH` to read a different config file. An
`ARTIFLOW_BASE_URL` value takes precedence over `base_url`. Telemetry defaults
to enabled; set `telemetry = false` to disable it persistently.

## Authentication

Remote commands require a GitHub-backed Artiflow session. Configure the server
URL first, then start the browser-based device authorization flow:

```sh
artiflow auth login
```

The command displays a one-time code and opens the Artiflow authorization page.
Sign in with GitHub if prompted, confirm the displayed code, and approve the
CLI. If the browser cannot be opened automatically, use the printed URL, or
disable automatic opening explicitly:

```sh
artiflow auth login --no-open
```

Inspect or remove the credential for the configured server with:

```sh
artiflow auth status
artiflow auth status --json
artiflow auth logout
```

Credentials are stored separately for each normalized Artiflow base URL. The
default credential file is `~/.artiflow/credentials.json`; set
`ARTIFLOW_CREDENTIALS_PATH` to use a different path. When
`ARTIFLOW_CONFIG_PATH` is set without an explicit credentials path, the
credential file is stored next to that config file. Credential files are
written atomically with owner-only permissions on supported filesystems.

For safety, non-loopback Artiflow servers must use HTTPS. A credential rejected
by the server is removed automatically, after which `artiflow auth login` must
be run again.

Artifact URLs also require the owning user's authenticated browser session. An
Artifact URL does not grant public or cross-account access.

## Telemetry

The CLI exports Effect traces and structured logs using OTLP/HTTP protobuf. By
default it sends traces to `http://127.0.0.1:4318/v1/traces` and logs to
`http://127.0.0.1:4318/v1/logs`.

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to change the collector base URL:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.example.com artiflow version
```

`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and
`OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` are optional full-URL overrides. Set
`OTEL_SDK_DISABLED=true` to disable telemetry. When set,
`OTEL_SDK_DISABLED` takes precedence over the config file, so `false` explicitly
enables telemetry; an unset or empty value defers to the config file. See
[`docs/telemetry.md`](../../docs/telemetry.md) for the signal precedence,
service identities, exported fields, and privacy policy.
