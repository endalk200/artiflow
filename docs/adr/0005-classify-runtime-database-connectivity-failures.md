# Classify Runtime Database Connectivity Failures

`@app/database` treats clear database connectivity failures as `ConnectionUnavailable` before applying Prisma request-specific error mapping. This includes Prisma connectivity codes such as `P1000`, `P1001`, `P1002`, and `P1017`, driver/network codes such as `ECONNREFUSED`, `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, and `EPIPE`, and runtime connection-loss messages such as `connection terminated` or `server closed the connection`.

With Prisma v7 and `@prisma/adapter-pg`, `client.$connect()` is not a reliable proof that PostgreSQL is reachable. During local failure testing, `client.$connect()` reported success against an unavailable database, and the first real query failed instead. That first-query failure surfaced as a `PrismaClientKnownRequestError` with code `ECONNREFUSED`, not as `PrismaClientInitializationError`. Other runtime connection losses can surface as `PrismaClientUnknownRequestError` or lower-level driver errors, depending on timing and the adapter failure path.

The database boundary therefore checks generic connection-unavailable signals before entering the Prisma known-request switch. This prevents network codes such as `ECONNREFUSED` from falling through a Prisma switch default into `UnexpectedDatabaseError`.

## Consequences

Runtime database outages are classified as `ConnectionUnavailable`, which is retryable and can be translated by domain repositories into retryable domain failures such as `PostOperationFailed`. Traces and logs should show the database error tag as `ConnectionUnavailable` instead of `UnexpectedDatabaseError` for clear connectivity failures.

The mapper intentionally remains conservative for unrelated unknown request failures. `PrismaClientUnknownRequestError` is only treated as `ConnectionUnavailable` when its message contains a recognized connection-loss signal; otherwise it remains an unexpected database failure.

Tests for the database boundary should cover multiple failure shapes: Prisma connectivity codes, Prisma known request errors with network codes, Prisma unknown request connection-loss messages, and driver-level network errors. Future simplifications must not assume that database unavailability always appears as `PrismaClientInitializationError`.
