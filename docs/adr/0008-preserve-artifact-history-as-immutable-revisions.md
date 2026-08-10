# Preserve Artifact History as Immutable Revisions

An Artifact has a stable identity and URL, and every subsequent publish creates an immutable Revision instead of overwriting prior content. The stable URL presents the latest Revision while revision-specific URLs preserve previously reviewed content; both require the owning user's authenticated session. Deleting the Artifact removes the whole document and its history rather than permitting individual Revisions to be edited in place.
