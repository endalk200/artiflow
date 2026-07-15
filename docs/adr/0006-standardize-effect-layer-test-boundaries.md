# Standardize Effect Layer Test Boundaries

Effect-based server and database tests use `@effect/vitest` so tests can be written as Effect programs with explicit layer provisioning. Database package tests exercise the public `Database` boundary with fake Prisma/client failures; domain repository adapters get the primary database-backed integration coverage against PostgreSQL and real migrations; services are unit tested for service-owned policy such as operation failure wrapping; RPC schema tests are separated from in-memory handler tests.

## Consequences

UI and browser E2E tests continue to use their existing Vitest and Playwright styles. Repository integration tests require Docker and fail when Docker is unavailable, because a passing integration command should mean the real database path actually ran. Real HTTP/RPC serialization coverage is deferred to app-level route or E2E tests instead of being duplicated inside domain package handler tests.
