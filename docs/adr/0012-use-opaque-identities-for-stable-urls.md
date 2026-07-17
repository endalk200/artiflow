# Use Opaque Identities for Stable URLs

Projects, Artifacts, and Revisions use opaque platform-assigned IDs for identity and stable URLs, while Project names and Artifact titles remain mutable, non-unique display text; Revisions also receive a server-assigned number scoped to their Artifact for readable history. This prevents renaming from breaking links and avoids global slug uniqueness rules, while leaving room to add decorative slugs later without making them authoritative.
