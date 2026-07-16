# Issue Tracker: GitHub

Issues and specifications for this repository live in GitHub Issues at `endalk200/artiflow`. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,body,labels,comments`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`; `gh` does this automatically inside the clone.

## Pull Requests As A Triage Surface

**PRs as a request surface: no.**

Triage GitHub Issues only. Do not include external pull requests in the incoming request queue.

GitHub shares one number space across issues and pull requests. If a bare reference such as `#42` is ambiguous, try `gh pr view 42` and fall back to `gh issue view 42`.

## Skill Operations

When a skill says "publish to the issue tracker," create a GitHub issue.

When a skill says "fetch the relevant ticket," run `gh issue view <number> --comments`.

## Wayfinding Operations

The map is one issue labeled `wayfinder:map`, with child issues as tickets. Resolve every canonical label role through `docs/agents/triage-labels.md`.

- Create child tickets with the matching `wayfinder:<type>` label.
- Link children as GitHub sub-issues when available. Otherwise, use a task list in the map and put `Part of #<map>` at the top of each child.
- Use GitHub's native issue dependencies for blocking edges. The dependency API requires the blocker's numeric database ID, not its issue number or node ID.
- If native dependencies are unavailable, put `Blocked by: #<number>, #<number>` at the top of the child.
- The frontier contains open, unassigned children with no open blockers; the first ticket in map order wins.
- Claim with `gh issue edit <number> --add-assignee @me`.
- Resolve by commenting with the answer, closing the ticket, and adding its context pointer to the map's Decisions-so-far section.
