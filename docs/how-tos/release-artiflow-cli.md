# Release the Artiflow CLI

Artiflow publishes the public `artiflow` npm package and `artiflow` executable. The version source is `apps/cli/package.json`, release tags use `artiflow-cli-vX.Y.Z`, and staging uses the protected `npm-production` GitHub environment.

## Required configuration

GitHub must enforce these controls:

- Protect `main` with the required `Quality Gate` and `Analyze` checks.
- Apply protections to administrators and block force pushes and deletion.
- Restrict `npm-production` to `main`, require a reviewer, and disable admin bypass.
- Protect `artiflow-cli-v*` tags from deletion and rewriting.
- Allow GitHub Actions to create pull requests, and configure `RELEASE_PR_TOKEN` when release pull requests must trigger GitHub Actions automatically.

npm must configure the `artiflow` trusted publisher for repository `endalk200/artiflow`, workflow `publish-npm.yml`, and environment `npm-production`. Allow `npm stage publish` only; do not allow direct `npm publish`. Package publishing access must require 2FA and disallow tokens.

After authenticating npm CLI 11.15 or newer, inspect any existing relationship with `npm trust list artiflow --json`. Revoke an obsolete direct-publish relationship, then configure the stage-only publisher with:

```sh
npm trust github artiflow \
  --file publish-npm.yml \
  --repository endalk200/artiflow \
  --environment npm-production \
  --allow-stage-publish \
  --yes
```

## Normal release

### 1. Add a Changeset

Create the feature or fix pull request into `main`. If it should release the CLI, run:

```sh
bun run changeset
```

Select the appropriate semver bump for `artiflow`. Before merging, run the repository checks required by `AGENTS.md` and wait for the protected GitHub checks.

### 2. Review the Version Packages pull request

After the change reaches `main`, the `Release PR` workflow updates `changeset-release/main` and opens or updates the `Version Packages` pull request. Review that:

- `apps/cli/package.json` has the intended version.
- `apps/cli/CHANGELOG.md` contains the intended entry.
- `apps/cli/src/version.generated.ts` matches the package version.
- No unrelated files are present.

Pull requests created with the repository `github.token` do not trigger additional GitHub Actions workflows. Configure a narrowly scoped `RELEASE_PR_TOKEN`, open the pushed release branch manually, or close and reopen the bot-created pull request before merging so `Quality Gate` and `Analyze` run on its head commit.

### 3. Merge and prepare the package

Merging the version pull request changes `apps/cli/package.json`, which triggers `Stage npm Release`. The preparation job checks the registry before installing dependencies. If the version already exists, it skips successfully only when the package has SLSA provenance from this repository and workflow, the matching GitHub Release exists, and its tag points to the provenance commit.

For a new version, preparation audits the CLI's build and test dependency closure and runs the CLI package's formatting check, type check, lint, unit tests, and build through Turborepo. Repository-wide and web-application checks remain the responsibility of the protected `Quality Gate`; the npm workflow does not configure, audit, build, or exercise the web application. It then packs one CLI tarball, verifies the exact file allowlist, installs and smoke-tests that tarball, records its SHA-256 checksum, and uploads it as a short-lived workflow artifact. It also packs the pinned npm CLI needed for staging, audits the exact bundled production dependency tree, and records its checksum. This job has no OIDC permission.

### 4. Approve GitHub staging

The separate staging job waits for `npm-production` approval. Approve only when:

- The run is from `main` and the expected version pull request commit.
- `Quality Gate` and `Analyze` passed for the release pull request.
- The version and changelog are expected.
- Preparation and package verification passed.

After approval, the job downloads the verified release and npm CLI artifacts, validates both checksums, and runs:

```sh
npm stage publish ./artiflow-X.Y.Z.tgz --access public --tag latest --provenance
```

Successful staging creates `artiflow-cli-vX.Y.Z` at the workflow commit and a draft GitHub Release. The workflow fails if that tag already points at another commit.

### 5. Approve the staged package in npm

In npm's Staged Packages view, verify the package name, version, provenance commit, `latest` tag, and contents. Approve the staged package with the maintainer account and 2FA. The package becomes public only after this approval.

### 6. Publish the GitHub Release

After npm shows the package as public, publish the draft GitHub Release. Confirm its tag points to the provenance commit before publication.

## Recovery

Re-run only failed jobs from the original workflow run when preparation, staging, tag creation, or draft-release creation fails transiently. This preserves the original commit and job outputs.

Do not dispatch the staging workflow from another branch. The workflow and GitHub environment both reject non-`main` refs.

If npm already contains a version but its GitHub Release is missing, the workflow fails closed instead of tagging the current commit. Recover only after identifying the original publishing commit from npm provenance; create or verify `artiflow-cli-vX.Y.Z` at that exact commit, then create the GitHub Release from the verified tag.

If npm reports that the version is already staged, inspect it with `npm stage list artiflow` and `npm stage view <stage-id>`. Approve the existing stage or reject it with 2FA before attempting to stage that version again.
