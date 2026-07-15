# Normalize Database Errors at the Package Boundary

`@app/database` exposes `Database` and `DatabaseLive` as the primary persistence boundary instead of making consumers handle raw Prisma failures directly. The package provides `query`, `mutation`, and `transaction` helpers that convert Prisma/PostgreSQL failures into a shared, precise `DatabaseError` union with stable fields such as operation, optional model, affected fields, and original cause; domain packages translate those persistence failures into domain errors like `PostNotFound` or future conflict errors.

Transactions receive a wrapped transaction context with `query`, `mutation`, and a raw client escape hatch so nested operations stay inside the same normalization path. Transaction retries are opt-in through options, allowing repositories to retry recognized retryable failures such as write conflicts only when the operation semantics are safe.
