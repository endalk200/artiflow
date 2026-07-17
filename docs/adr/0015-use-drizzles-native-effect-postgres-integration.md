# Use Drizzle's Native Effect PostgreSQL Integration

Artiflow uses the Drizzle ORM 1.0 release-candidate line through `drizzle-orm/effect-postgres`, backed by `@effect/sql-pg`, with schema and migrations managed by the matching Drizzle Kit release candidate. This preserves Drizzle's typed relational model while allowing database queries, transactions, failures, logging, and dependency injection to remain native Effect programs; because both Drizzle's integration and Effect v4 are prerelease APIs, the workspace pins exact mutually compatible versions instead of floating `@rc` or beta ranges.
