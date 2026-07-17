import { Data } from "effect";

export class DestructiveConfirmationRequired extends Data.TaggedError("DestructiveConfirmationRequired")<{
	readonly resourceId: string;
}> {}

export class SourceFileError extends Data.TaggedError("SourceFileError")<{
	readonly cause: unknown;
	readonly message: string;
	readonly path: string;
}> {}

export class SkillInstallError extends Data.TaggedError("SkillInstallError")<{
	readonly cause: unknown;
	readonly message: string;
	readonly path: string;
}> {}

export class ArtifactProjectMismatch extends Data.TaggedError("ArtifactProjectMismatch")<{
	readonly artifactId: string;
	readonly artifactProjectId: string;
	readonly linkedProjectId: string;
}> {}
