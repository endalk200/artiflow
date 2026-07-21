# Installing the Artiflow skill with the `skills` CLI

Research date: 2026-07-21

## Conclusion

The corrected bundle at `skills/artiflow/` is compatible with `skills` CLI 1.5.19. A local discovery test found exactly one skill named `artiflow`, and a clean Codex project install produced:

```text
.agents/skills/artiflow/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    └── visual-components.md
```

The desired public command is a supported source form:

```bash
npx skills add https://github.com/endalk200/artiflow
```

It does **not work from GitHub yet**. At research time, `git status --short` reports `?? skills/`, and running the command above with `--list` returns `No skills found`. The CLI clones the remote repository into a temporary directory, so it cannot see untracked or merely local files; the new skill must be committed and pushed to the repository's default branch (`main`) before the plain repository URL can discover it. The CLI's full-GitHub-URL form is documented in its README, and its implementation performs a depth-one clone before discovery. ([source formats](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/README.md#L28-L48), [clone implementation](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/git.ts#L231-L242))

## Expected repository layout

Keep the current corrected structure:

```text
skills/artiflow/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    └── visual-components.md
```

The CLI defines a skill as a directory containing `SKILL.md` with string `name` and `description` fields. It searches the standard flat layout `skills/<name>/SKILL.md`, so `skills/artiflow/SKILL.md` is the conventional and directly discoverable form. ([creating skills](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/README.md#L325-L352), [discovery rules](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/README.md#L369-L386), [frontmatter parser](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/skills.ts#L69-L105))

`agents/openai.yaml` must remain relative to that skill root. OpenAI documents this path as the optional skill metadata and invocation-policy file; the current `policy.allow_implicit_invocation: false` therefore remains meaningful after installation. ([OpenAI skill anatomy](https://developers.openai.com/codex/skills))

## What gets installed

For disk-backed GitHub or local sources, the CLI copies the discovered skill directory recursively. It preserves nested paths and excludes only `metadata.json`, `.git`, `__pycache__`, and `__pypackages__`; consequently both `references/visual-components.md` and `agents/openai.yaml` are included. ([installer implementation](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/installer.ts#L423-L496), [disk-backed install path](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/add.ts#L1705-L1727))

All three installed files were byte-identical to their source files. A project install also creates or updates `skills-lock.json` at the project root; that lock file is installation metadata, not part of the copied skill directory.

The installed directory name comes from the frontmatter `name`, sanitized for filesystem use, rather than from a nested supporting-directory name. For this bundle, the result is `artiflow`. ([install naming](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/installer.ts#L265-L300))

## Project and global scope

- Project scope is the documented default. For Codex, CLI 1.5.19 maps it to `<project>/.agents/skills/artiflow`.
- `--global` / `-g` installs for the user. Codex uses the CLI's universal `.agents/skills` directory, so its effective global destination is `~/.agents/skills/artiflow`.
- Interactive runs can ask for scope and installation method. A deterministic project install is:

  ```bash
  npx skills add https://github.com/endalk200/artiflow --skill artiflow --agent codex --yes
  ```

  Add `--global` for a user-wide install.

The CLI's Codex configuration declares the project directory as `.agents/skills`. Universal agents resolve both project and global installs through the canonical `.agents/skills` directory, which supersedes the separate `globalSkillsDir` field during installation; OpenAI's current Codex documentation also lists `$HOME/.agents/skills` as the user scope. ([scope and methods](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/README.md#L90-L104), [Codex agent mapping](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/agents.ts#L195-L202), [effective universal-agent path resolution](https://github.com/vercel-labs/skills/blob/777599e1159e401b11ce4c8a57c20f09a8f1596e/src/installer.ts#L98-L149), [OpenAI skill scopes](https://developers.openai.com/codex/skills))

## Verification record

All tests used the first-party `skills` package at version 1.5.19 with telemetry disabled and temporary destination directories.

| Check | Result |
| --- | --- |
| `npx --yes skills@1.5.19 --version` | `1.5.19` |
| Local source with `add <repo-path> --list` | Found exactly one skill: `artiflow` |
| Local source installed with `--skill artiflow --agent codex --yes` | Installed successfully at `.agents/skills/artiflow` |
| Installed file tree | `SKILL.md`, `references/visual-components.md`, and `agents/openai.yaml` |
| Installed file contents | All three files were byte-identical to the source files |
| Project metadata | Wrote `skills-lock.json` at the project root |
| GitHub URL with `add https://github.com/endalk200/artiflow --list` | `No skills found` because the new `skills/` tree is not in the remote default branch |

After committing and pushing the bundle to `main`, rerun the remote `--list` check, then perform one clean install from the exact public URL before publishing the installation instruction.
