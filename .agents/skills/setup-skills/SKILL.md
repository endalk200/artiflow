---
name: setup-skills
description: Configure this repo for the engineering skills — set up its issue tracker, triage and Wayfinder label vocabulary, and domain doc layout. Run once before first use of the other engineering skills.
disable-model-invocation: true
---

# Setup Skills

Scaffold the per-repo configuration that the engineering skills assume:

- **Issue tracker** — where issues live (GitHub by default; local markdown is also supported out of the box)
- **Triage and Wayfinder labels** — the strings used by whichever of those skills are installed
- **Domain docs** — where `CONTEXT.md` and ADRs live, and the consumer rules for reading them

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `git remote -v` and `.git/config` — is this a GitHub repo? Which one?
- `AGENTS.md` and `CLAUDE.md` at the repo root — does either exist? Is there already an `## Agent skills` section in either?
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/` — does this skill's prior output already exist?
- `.scratch/` — sign that a local-markdown issue tracker convention is already in use
- Whether `triage` and `wayfinder` are installed, either as sibling skill folders or in the available skill catalog
- Monorepo signals such as `pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or multiple populated packages with their own source roots

### 2. Present findings and ask

Summarise what's present and what's missing. Then take the applicable sections in order, one answer at a time. Lead each section with the recommended answer so the user can accept it in a word. Give a short explainer only when the choice genuinely branches, and skip a section when exploration or existing configuration already settled it.

**Section A — Issue tracker.**

> Explainer: The "issue tracker" is where issues live for this repo. Skills like `to-tickets`, `triage`, `to-spec`, `code-review`, and `wayfinder` read from and write to it — they need to know whether to call `gh issue create`, write a markdown file under `.scratch/`, or follow some other workflow you describe. Pick the place you actually track work for this repo.

Default posture: these skills were designed for GitHub. If a `git remote` points at GitHub, propose that. If a `git remote` points at GitLab (`gitlab.com` or a self-hosted host), propose GitLab. Otherwise (or if the user prefers), offer:

- **GitHub** — issues live in the repo's GitHub Issues (uses the `gh` CLI)
- **GitLab** — issues live in the repo's GitLab Issues (uses the [`glab`](https://gitlab.com/gitlab-org/cli) CLI)
- **Local markdown** — issues live as files under `.scratch/<feature>/` in this repo (good for solo projects or repos without a remote)
- **Other** (Jira, Linear, etc.) — ask the user to describe the workflow in one paragraph; the skill will record it as freeform prose

When `triage` is installed and the user picked **GitHub** or **GitLab**, record **PRs as a request surface: no** without asking. The tracker template explains the option so a repository that treats external PRs as requests can enable it later. For local-markdown and other trackers, omit the setting.

**Section B — Triage and Wayfinder label vocabulary.**

Run this section when `triage` or `wayfinder` is installed. Skip it when neither is installed.

> Explainer: Triage uses labels for categories and workflow states. Wayfinder uses labels to distinguish maps and decision-ticket types. Configure only the roles used by the installed skills so they map to strings that exist in the selected tracker.

If `triage` is installed, configure both category roles and state roles:

- `bug` — something is broken
- `enhancement` — new feature or improvement
- `needs-triage` — maintainer needs to evaluate
- `needs-info` — waiting on reporter
- `ready-for-agent` — fully specified, AFK-ready
- `ready-for-human` — needs human implementation
- `wontfix` — will not be actioned

If `wayfinder` is installed, configure its artifact roles:

- `wayfinder:map` — the shared map for one effort
- `wayfinder:research` — an AFK research ticket
- `wayfinder:prototype` — a prototype ticket
- `wayfinder:grilling` — a decision-making conversation
- `wayfinder:task` — prerequisite work that unblocks a decision

Default: each applicable role's string equals its name. Ask one question: **"Keep the recommended label mappings?"** On yes, use the defaults or the compatible existing labels exploration found. Only if the user says no, collect the overrides. If their issue tracker has no existing labels, recommend the defaults.

For GitHub or GitLab, compare the final mapping with the labels that already exist. Show the user any missing labels and ask whether to create them. If they approve, create and verify the labels with the configured tracker CLI. If they decline, record the mapping and identify which installed skill cannot apply each missing role.

**Section C — Domain docs.**

> Explainer: Some skills (`improve-codebase-architecture`, `domain-modeling`, and `tdd`) read a `CONTEXT.md` file to learn the project's domain language, and `docs/adr/` for past architectural decisions. They need to know whether the repo has one global context or multiple (e.g. a monorepo with separate frontend/backend contexts) so they look in the right place.

Default to **single-context** — one `CONTEXT.md` plus `docs/adr/` at the repository root. Write that choice without asking unless exploration found genuine monorepo signals. When it did, offer **multi-context** — a root `CONTEXT-MAP.md` pointing to per-context `CONTEXT.md` files — and confirm the layout.

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever of `CLAUDE.md` / `AGENTS.md` is being edited (see step 4 for selection rules)
- The contents of `docs/agents/issue-tracker.md` and `docs/agents/domain.md`
- The contents of `docs/agents/triage-labels.md` when Section B ran

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `AGENTS.md` exists, edit it.
- Else if `CLAUDE.md` exists, edit it.
- If neither exists, ask the user which one to create — don't pick for them.

When both exist, edit `AGENTS.md`. Never create one instruction file when the other already exists.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Skill labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of layout — "single-context" or "multi-context"]. See `docs/agents/domain.md`.
```

Include the labels subsection only when Section B ran.

Then write the docs files using the seed templates in this skill folder as a starting point:

- [issue-tracker-github.md](./issue-tracker-github.md) — GitHub issue tracker
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md) — GitLab issue tracker
- [issue-tracker-local.md](./issue-tracker-local.md) — local-markdown issue tracker
- [triage-labels.md](./triage-labels.md) — label mapping, only when Section B ran
- [domain.md](./domain.md) — domain doc consumer rules + layout

For "other" issue trackers, write `docs/agents/issue-tracker.md` from scratch using the user's description.

### 5. Done

Tell the user the setup is complete and which engineering skills will now read from these files. Mention they can edit `docs/agents/*.md` directly later — re-running this skill is only necessary if they want to switch issue trackers or restart from scratch.
