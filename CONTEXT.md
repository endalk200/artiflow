# Artiflow

Artiflow turns agent-produced documents into private visual experiences organized by the work they belong to.

## Language

**Project**:
A long-lived grouping for artifacts that belong to the same external work context.
_Avoid_: Workspace, repository

**Artifact**:
An individual agent-produced document, such as a plan or summary report, presented as a visual experience within a project.
_Avoid_: Project, file, report

**Artifact Source**:
The self-contained authored content and presentation metadata from which a revision is produced. It has a required title and may have a description.
_Avoid_: File, payload

**Source Format**:
The versioned authoring contract that determines how artifact source is validated and rendered.
_Avoid_: File format, renderer version

**Visual Component**:
A reusable presentation primitive that an artifact source composes to communicate information visually.
_Avoid_: Document template, widget

**Artiflow Skill**:
The explicitly invoked agent instructions that author Artifact Source, publish it through the CLI, and direct the agent to open the resulting Artifact URL.
_Avoid_: Plugin, automatic publisher

**Revision**:
An immutable published state of an artifact. An artifact retains a stable identity while accumulating revisions over time.
_Avoid_: Version, overwrite

**Publish**:
Submit artifact source to create a new artifact or append a revision to an existing artifact.
_Avoid_: Push, upload
