---
name: create-pr
description: Publish the current branch as a review-ready pull or merge request.
disable-model-invocation: true
---

# Create PR

Publish the current branch with the forge-native CLI: `gh` for GitHub and `glab` for GitLab. Treat publication as an idempotent operation: return an existing open PR or MR instead of creating a duplicate.

## Process

### 1. Pin the publication target

Inspect the current branch, worktree, remotes, upstream, and repository instructions. Select the push remote in this order:

1. the current branch's configured push remote;
2. `remote.pushDefault`;
3. the current branch's upstream remote;
4. `origin`;
5. the only configured remote.

Ask the user to choose when this leaves multiple plausible targets. Resolve the selected remote's push URL and repository identity.

Choose the provider from the remote host:

- GitHub, including GitHub Enterprise: `gh`;
- GitLab, including self-managed GitLab: `glab`.

For `github.com` and `gitlab.com`, the hostname is decisive. For another host, use the matching CLI's authentication status and a read-only repository lookup; ask when both or neither provider resolves the repository. Check that the selected CLI is installed and authenticated for that host.

Use the user-specified base branch when present. Otherwise query the selected repository's default branch with its provider CLI. The target is pinned only when the provider, host, repository, remote, source branch, base branch, and any user-specified ready-or-draft preference are unambiguous.

### 2. Establish the publishable range

Fetch the selected remote's base branch, then inspect:

- `git status --short`;
- commits in `<remote>/<base>..HEAD`;
- the diff and diff stat for `<remote>/<base>...HEAD`;
- whether the source branch already exists on the selected remote.

Continue from a named branch containing at least one commit not in the base. A detached HEAD, the base branch itself, or an empty commit range is a blocker.

Uncommitted changes are outside the published range. Continue when they are unrelated and can remain untouched. If they appear to belong to the requested PR, stop and report that they must be committed or intentionally excluded; creating a PR does not imply permission to commit them.

This step is complete when every committed change in the range has been inspected and every worktree change is accounted for as included, intentionally excluded, or blocking.

### 3. Build the review packet

Read the applicable PR or MR template and preserve its required headings, prompts, and checklists. Derive the title and body from the entire committed range, repository instructions, and any linked issue or spec.

Without a template, use:

```markdown
## Summary

- <material behavior or outcome>

## Testing

- `<command>` — <result>
```

Write a concise, imperative title that represents the whole change. Explain why the change exists and call out migrations, compatibility concerns, risks, screenshots, or follow-ups when they matter. Include only verification that actually ran. Add closing keywords, reviewers, assignees, labels, milestones, or issue links only when requested or established by repository conventions and verified against the forge.

Respect an explicit draft or ready request. Without one, publish a draft when known verification failures or intentionally incomplete work remain; otherwise publish ready for review.

This step is complete when the title and body accurately account for every material change, every claim is supported by the diff or observed verification, and the final ready-or-draft state has been selected.

### 4. Verify and push

Run the repository-prescribed checks relevant to the committed range. Record the exact commands and results for the body. If a required check cannot run, state why and use draft status unless the user explicitly chose otherwise.

Push the named source branch to the selected remote with an ordinary fast-forward push, setting its upstream when needed. A history rewrite requires explicit user direction.

After pushing, verify that the remote source SHA equals local `HEAD`. This step is complete only when the remote contains the exact commit that will head the PR or MR.

### 5. Create or recover the request

First search the selected repository for an open request from the source branch. If one exists, verify its URL, source SHA, base, and ready-or-draft state. Return it when it matches the pinned target; when it conflicts, report the mismatch instead of creating a duplicate.

Otherwise create non-interactively with explicit repository, base, source, title, body, and draft state:

#### GitHub

```text
gh pr create --repo <[host/]owner/repo> --base <base> --head <branch> --title <title> --body-file <body-file> [--draft]
```

#### GitLab

```text
glab mr create --repo <remote-url-or-namespace/project> --target-branch <base> --source-branch <branch> --title <title> --description <body> --yes [--draft]
```

Treat a timeout or ambiguous CLI failure as an unknown outcome. Search again for the source branch before retrying creation.

Read the created request back through the same CLI and verify its URL, title, source SHA, base branch, and draft state. Publication is complete only when exactly one open PR or MR matches the pinned target and its remote head is local `HEAD`.

## Report

Return:

- the PR or MR URL;
- provider and `source -> base`;
- ready or draft state;
- pushed commit SHA;
- verification results;
- any intentionally excluded worktree changes or known follow-ups.

If publication stops, name the failed completion criterion and the concrete next action.
