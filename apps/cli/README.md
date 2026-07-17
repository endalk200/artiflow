# Artiflow CLI

The command-line interface for Artiflow.

## Install

```sh
npm install -g artiflow
artiflow --help
```

## Install the agent Skill

Install the explicit-only Artiflow Skill for the current codebase:

```sh
artiflow skill install
```

Install it globally for the current user instead:

```sh
artiflow skill install --global
```

The installer writes the interoperable Agent Skills bundle under
`.agents/skills/artiflow` and a Claude Code-compatible copy under
`.claude/skills/artiflow`. It configures explicit invocation for Codex,
OpenCode, Claude Code, and Cursor. Repeating the command updates a managed
installation or reports that it is already current. An unmanaged existing
Artiflow Skill is preserved unless `--force` is supplied.

## Configuration

Artiflow connects to `http://localhost:3000` by default. Override the server for
one command or shell session with `ARTIFLOW_BASE_URL`:

```sh
ARTIFLOW_BASE_URL=https://artiflow.example.com artiflow project show
```

The CLI also reads `~/.artiflow/config.toml` when present:

```toml
base_url = "https://artiflow.example.com"
```

Set `ARTIFLOW_CONFIG_PATH` to read a different config file. An
`ARTIFLOW_BASE_URL` value takes precedence over the config file.
