# Treat Visual Components as a Compatible Authoring API

Artifact Source composes a small reusable Visual Component catalog—initially Callout, Steps, FileTree, Mermaid, Timeline, Comparison, Checklist, and StatGrid—alongside standard Markdown instead of using document-specific templates. Component names and existing prop semantics are a backward-compatible authoring API because immutable stored Revisions must remain renderable after the component implementation evolves; new optional capabilities may be added, but incompatible changes require an explicit source or renderer migration strategy.
