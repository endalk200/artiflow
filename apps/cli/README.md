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
```

Set `ARTIFLOW_CONFIG_PATH` to read a different config file. An
`ARTIFLOW_BASE_URL` value takes precedence over the config file.
