---
name: babysit-pr
description: Validate and triage pull-request review findings before addressing selected items.
disable-model-invocation: true
---

Treat every review finding as an unverified claim. Build a **docket** that lets the user understand the concern, inspect the agent's judgement, and direct the next action by stable finding ID.

Triage and execution are separate phases. A triage run reads the PR and may run local diagnostics, but it leaves code, PR text, comments, thread state, labels, and checks unchanged. Cross into execution only after the user directs it.

## Process

### 1. Pin the PR snapshot

Identify the PR from the user's reference or the current branch. Record its URL, base branch, head SHA, linked issue or spec, and collection time. Fetch the remote state when the local checkout does not match the PR head.

Collect every surface on which a reviewer may have left a finding:

- review threads, including resolved and outdated threads;
- submitted review bodies and inline comments;
- PR conversation comments;
- check-run, status, and bot summaries that contain actionable findings;
- review-agent sections or findings embedded in the current PR description.

Use a forge integration or CLI that exposes pagination and review-thread state. Follow pagination to exhaustion. Treat ordinary PR-description prose as scope context; treat it as a finding only when headings, markers, signatures, or wording indicate reviewer output. Preserve the source URL and author for every candidate finding.

This step is complete when the head SHA is pinned and every paginated feedback surface has been inventoried.

### 2. Normalize the docket

Split compound comments into independently decidable findings. Merge duplicates that describe the same underlying concern, retaining every source and any disagreement between reviewers. Assign stable IDs `F1`, `F2`, and so on. Within the current task or monitoring run, reuse an ID for the same concern and assign new IDs only to new concerns. A fresh task may start a fresh ID sequence unless the prior docket is available.

Keep reviewer claims distinct from your conclusions. A loud, repeated, or high-severity label is evidence of reviewer opinion, not evidence that the code is wrong.

This step is complete when every actionable claim maps to exactly one docket entry and every source maps back to a docket entry or is recorded as non-actionable.

### 3. Investigate each claim

Judge the code at the pinned head, not merely the quoted hunk. For every docket entry:

1. Read the diff and enough surrounding code to understand the execution path and invariants.
2. Check the PR objective, linked issue or spec, repository instructions, tests, and relevant history.
3. Trace callers, data flow, error paths, and platform or configuration assumptions implicated by the claim.
4. Run a focused reproduction, test, type check, lint check, or static inspection when it can materially distinguish the outcomes.
5. Check whether a later commit already addressed the concern.

Use repository evidence for scope. A documented follow-up can establish intentional deferral. An unstated plan cannot make a finding out of scope; classify that as a user decision. If evidence remains unavailable, state what is missing instead of filling the gap with confidence.

If the PR head changes during investigation, record the new SHA and revalidate every finding whose evidence could have changed.

This step is complete when every finding has evidence sufficient for a verdict or an explicit, irreducible evidence gap.

### 4. Classify on separate axes

Give every finding one value from each axis:

- **Validity:** `confirmed`, `plausible`, `unsupported`, `contradicted`, or `already addressed`.
- **Scope:** `in scope`, `out of scope`, or `needs user decision`.
- **Recommendation:** `fix now`, `defer`, `reply and resolve`, `investigate further`, or `no action`.
- **Priority:** `blocking`, `high`, `medium`, or `low` impact if left as-is.
- **Confidence:** `high`, `medium`, or `low`, based on the evidence you actually checked.

Validity and scope are independent: a reviewer can be technically correct about a concern that belongs in a follow-up, or incorrect about work that is central to this PR. Recommend `defer` only when the concern is valid and there is a concrete follow-up destination or the user needs to choose one.

This step is complete when all five fields are populated and mutually consistent for every docket entry.

### 5. Present the triage

Lead with the pinned SHA and a compact table of IDs, titles, validity, scope, priority, and recommendation. Then explain each docket entry in this form:

#### F1 — Short finding title

- **Source:** reviewer and linked comment(s)
- **Background:** the relevant behavior and why the reviewer cares, in plain language
- **Claim:** a faithful, concise restatement of what the reviewer alleges
- **Evidence checked:** concrete code paths, tests, specs, history, or commands examined
- **Verdict:** validity, scope, priority, and confidence
- **Agent take:** your independent judgement, including the practical risk or tradeoff
- **Suggested direction:** a specific next action and, when useful, a draft reply that has not been posted

Keep enough detail to support the verdict without turning the report into a code walkthrough. End with a copyable direction block using IDs, for example:

```text
Fix: F1, F4
Defer to <issue/PR>: F2
Reply and resolve: F3
Investigate further: F5
```

If there are no actionable findings, say which surfaces were checked and that the docket is empty. Triage is complete only when every docket entry appears in both the summary and the detailed report.

### 6. Await and execute direction

Accept natural language or the direction block; the user need not repeat the background. Ask only about IDs whose requested disposition is ambiguous. Before acting, compare the current PR head with the triaged SHA and revalidate affected entries if it moved.

For directed findings:

- **Fix:** implement the smallest coherent correction, add or update focused tests, and run relevant verification.
- **Defer:** prepare or update the named follow-up artifact only when the user authorized that external write; otherwise provide its proposed text.
- **Reply and resolve:** post the approved explanation and resolve the thread only when the user directed both actions.
- **Investigate further:** gather the missing evidence and return an updated verdict before changing code.

Code-change direction does not imply permission to post replies, resolve threads, edit the PR description, create issues, commit, or push. Report completed work, verification, remaining docket entries, and any draft communications separately.

Execution is complete when every directed ID is either completed and verified or returned with a concrete blocker, while all undirected IDs remain untouched.

## Continued babysitting

When the user asks to keep watching, use the environment's monitoring or automation mechanism to repeat the collection and triage phases. Track source URLs or IDs, update timestamps, the PR-description digest, and head SHA so each sweep highlights new, changed, and newly stale findings. Reuse the docket IDs in each report.

Prior directions apply only to the findings they named. New findings always return through triage before execution.
