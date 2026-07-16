# Artiflow CLI

The command-line interface for Artiflow.

## Install

```sh
npm install -g artiflow
artiflow --help
```

## Configuration

Artiflow reads `~/.artiflow/config.toml` by default. Run:

```sh
artiflow config init
artiflow config validate
```

Environment overrides are available through `ARTIFLOW_CONFIG_PATH`,
`ARTIFLOW_TELEMETRY`, and `ARTIFLOW_OTLP_ENDPOINT`.
