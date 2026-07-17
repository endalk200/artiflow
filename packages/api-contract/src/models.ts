import { Schema } from "effect";

export const SourceFormatVersion = Schema.Literal(1);

export class Project extends Schema.Class<Project>("Project")({
	createdAt: Schema.String,
	id: Schema.String,
	name: Schema.String,
	updatedAt: Schema.String,
}) {}

export const CreateProjectPayload = Schema.Struct({
	idempotencyKey: Schema.String,
	name: Schema.String,
});

export const RenameProjectPayload = Schema.Struct({
	name: Schema.String,
});

export class ProjectNotFound extends Schema.ErrorClass<ProjectNotFound>(
	"ProjectNotFound",
)(
	{
		_tag: Schema.tag("ProjectNotFound"),
		projectId: Schema.String,
	},
	{ httpApiStatus: 404 },
) {}

export class InvalidProjectName extends Schema.ErrorClass<InvalidProjectName>(
	"InvalidProjectName",
)(
	{
		_tag: Schema.tag("InvalidProjectName"),
		message: Schema.String,
	},
	{ httpApiStatus: 422 },
) {}

export class IdempotencyConflict extends Schema.ErrorClass<IdempotencyConflict>(
	"IdempotencyConflict",
)(
	{
		_tag: Schema.tag("IdempotencyConflict"),
		idempotencyKey: Schema.String,
	},
	{ httpApiStatus: 409 },
) {}

export class InfrastructureError extends Schema.ErrorClass<InfrastructureError>(
	"InfrastructureError",
)(
	{
		_tag: Schema.tag("InfrastructureError"),
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {}

export class InvalidRequest extends Schema.ErrorClass<InvalidRequest>(
	"InvalidRequest",
)(
	{
		_tag: Schema.tag("InvalidRequest"),
		location: Schema.Literals(["params", "headers", "query", "payload"]),
		message: Schema.String,
	},
	{ httpApiStatus: 400 },
) {}

export const CreateArtifactPayload = Schema.Struct({
	idempotencyKey: Schema.String,
	source: Schema.String,
	sourceFormatVersion: Schema.Number,
});

export const AppendRevisionPayload = Schema.Struct({
	expectedCurrentRevisionId: Schema.String,
	idempotencyKey: Schema.String,
	source: Schema.String,
	sourceFormatVersion: Schema.Number,
});

export class Revision extends Schema.Class<Revision>("Revision")({
	artifactId: Schema.String,
	createdAt: Schema.String,
	description: Schema.optionalKey(Schema.String),
	id: Schema.String,
	number: Schema.Number,
	sourceFormatVersion: SourceFormatVersion,
	title: Schema.String,
}) {}

export class ArtifactSummary extends Schema.Class<ArtifactSummary>(
	"ArtifactSummary",
)({
	createdAt: Schema.String,
	currentRevisionId: Schema.String,
	description: Schema.optionalKey(Schema.String),
	id: Schema.String,
	projectId: Schema.String,
	revisionCount: Schema.Number,
	title: Schema.String,
	updatedAt: Schema.String,
}) {}

export class Artifact extends Schema.Class<Artifact>("Artifact")({
	...ArtifactSummary.fields,
	revisions: Schema.Array(Revision),
}) {}

export const ArtifactList = Schema.Array(ArtifactSummary);

export const PublishResult = Schema.Struct({
	artifactId: Schema.String,
	projectId: Schema.String,
	revisionId: Schema.String,
	revisionNumber: Schema.Number,
	url: Schema.String,
});

export const ArtifactSourceDiagnostic = Schema.Struct({
	code: Schema.String,
	line: Schema.optionalKey(Schema.Number),
	message: Schema.String,
});

export class InvalidArtifactSource extends Schema.ErrorClass<InvalidArtifactSource>(
	"InvalidArtifactSource",
)(
	{
		_tag: Schema.tag("InvalidArtifactSource"),
		diagnostics: Schema.Array(ArtifactSourceDiagnostic),
	},
	{ httpApiStatus: 422 },
) {}

export class UnsupportedSourceFormat extends Schema.ErrorClass<UnsupportedSourceFormat>(
	"UnsupportedSourceFormat",
)(
	{
		_tag: Schema.tag("UnsupportedSourceFormat"),
		sourceFormatVersion: Schema.Number,
	},
	{ httpApiStatus: 422 },
) {}

export class ArtifactNotFound extends Schema.ErrorClass<ArtifactNotFound>(
	"ArtifactNotFound",
)(
	{
		_tag: Schema.tag("ArtifactNotFound"),
		artifactId: Schema.String,
	},
	{ httpApiStatus: 404 },
) {}

export class RevisionNotFound extends Schema.ErrorClass<RevisionNotFound>(
	"RevisionNotFound",
)(
	{
		_tag: Schema.tag("RevisionNotFound"),
		artifactId: Schema.String,
		revisionNumber: Schema.Number,
	},
	{ httpApiStatus: 404 },
) {}

export class ArtifactRevisionConflict extends Schema.ErrorClass<ArtifactRevisionConflict>(
	"ArtifactRevisionConflict",
)(
	{
		_tag: Schema.tag("ArtifactRevisionConflict"),
		artifactId: Schema.String,
		currentRevisionId: Schema.String,
		expectedCurrentRevisionId: Schema.String,
	},
	{ httpApiStatus: 409 },
) {}
