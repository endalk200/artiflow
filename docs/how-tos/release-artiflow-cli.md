# Release the Artiflow CLI

The public npm package is `artiflow`, and its executable is also `artiflow`.
The first release is version `0.0.1`.

## One-time repository setup

Before a release commit reaches `main`:

1. Create the `npm-production` GitHub environment.
2. For the first CI release, add an `NPM_TOKEN` secret to that environment with
   permission to publish `artiflow` and bypass 2FA for automation.
3. Allow GitHub Actions to create pull requests, or add a
   `RELEASE_PR_TOKEN` repository secret.

## First release

The package already carries version `0.0.1`. When this implementation reaches
`main`, the npm release workflow:

1. Audits dependencies and runs the repository quality gates.
2. Builds the bundled CLI.
3. Verifies the npm package contents.
4. Installs the packed tarball and smoke-tests the `artiflow` executable.
5. Publishes `artiflow@0.0.1` to npm with provenance.
6. Creates the `artiflow-cli-v0.0.1` tag and GitHub release.

After `0.0.1` exists on npm, configure its trusted publisher for the
`endalk200/artiflow` repository, the `publish-npm.yml` workflow, and the
`npm-production` environment. Allow `npm publish`, then remove the `NPM_TOKEN`
secret. The same workflow will use OIDC for later releases without a registry
token.

## Later releases

Add a Changeset with:

```sh
bun run changeset
```

After the change reaches `main`, the release workflow maintains a Version
Packages pull request. Merging that pull request publishes the new npm version
and creates its GitHub release.
