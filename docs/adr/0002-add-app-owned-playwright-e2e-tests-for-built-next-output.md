# Add App-Owned Playwright E2E Tests for Built Next Output

We use Playwright for browser-level E2E tests owned by the app package they exercise, starting with `apps/web`. The default E2E command runs against built Next.js production output, uses the real application route handlers rather than RPC mocks, stays separate from the fast Vitest `test` command, and is orchestrated by Turborepo through package-local `test:e2e` tasks. This keeps browser tests aligned with deployed behavior while preserving fast package-level test feedback.
