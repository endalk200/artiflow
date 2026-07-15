# Add Prisma Postgres Database Package

`@app/database` exposes `Database` and `DatabaseLive` as the primary persistence boundary instead of making consumers handle raw Prisma failures directly. The package provides `query`, `mutation`, and `transaction` helpers that convert Prisma/PostgreSQL failures into a shared, precise `DatabaseError` union with stable fields such as operation, optional model, affected fields, and original cause; domain packages translate those persistence failures into domain errors like `PostNotFoundError` or future conflict errors.

Domain packages continue to own their repository contracts and domain-specific persistence adapters. `@app/database` only provides shared database infrastructure and the domain packages own repository implementations and `*RepoPrismaLive`

The application uses the Prisma-backed repository implementation with no runtime in-memory fallback. Missing, invalid, or non-Postgres `DATABASE_URL` values are application configuration failures. Local Prisma CLI workflows may provide development defaults, but application startup must require an explicit valid database URL.

## Consequences

The physical database contract is centralized in `packages/database/prisma/schema.prisma`, which avoids split migration histories and keeps Prisma aligned with its migration model. Prisma Client output is generated into the database package and is not committed, so Turborepo must generate it before development, builds, type checks, and database integration tests.

Domain packages map database records into domain models and translate expected domain failures, such as missing posts. Unexpected database failures remain infrastructure failures.

Database-backed integration tests should apply real Prisma migrations against PostgreSQL and run separately from the default unit/component test command. This introduces a stronger infrastructure dependency than the previous in-memory repository, but it removes non-production fallback behavior and verifies the real persistence path early.
