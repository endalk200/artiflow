# Require Optimistic Concurrency for Revisions

Appending a Revision requires the caller's expected current Revision ID, and the publication transaction advances an Artifact's current-Revision pointer only if that expectation still holds; otherwise the API returns `409 ArtifactRevisionConflict` and neither the CLI nor server retries the write automatically. This preserves a genuinely linear history when multiple agents work concurrently, while the Artifact's pointer or sequence is only concurrency infrastructure and title and description remain owned by the latest Revision.
