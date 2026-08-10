# Effect Skill Compatibility Check

This check pins the audited upstream versions from `../references/UPSTREAM.md`.
It typechecks the high-risk API shapes documented by the skill and scans the
skill for removed Effect 3 or early-v4 APIs.

Run:

```sh
pnpm install
pnpm run check
```

When updating the upstream manifest, update the exact package versions and
smoke cases here in the same change.
