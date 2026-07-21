import type {
	ArtifactNotFound,
	ArtifactRevisionConflict,
	IdempotencyConflict,
	InfrastructureError,
	InvalidArtifactSource,
	InvalidProjectName,
	InvalidRequest,
	ProjectNotFound,
	UnsupportedSourceFormat,
} from "@app/api-contract/models";
import { Console, Data, Effect, Runtime } from "effect";
import type { HttpClientError } from "effect/unstable/http/HttpClientError";

import { formatConfigError } from "../config/index.js";
import type {
	InvalidProjectId,
	InvalidProjectManifest,
	ProjectManifestFileError,
	ProjectManifestNotFound,
} from "../project-manifest.js";
import type { ArtifactProjectMismatch, DestructiveConfirmationRequired, SourceFileError } from "./command-errors.js";

export const CLI_EXIT_CODES = {
	conflict: 4,
	invalidInput: 2,
	invalidSource: 5,
	notFound: 3,
	unavailable: 6,
} as const;

export class CliFailure extends Data.TaggedError("CliFailure")<{
	readonly cause: unknown;
	readonly exitCode: number;
}> {
	readonly [Runtime.errorExitCode] = this.exitCode;
}

const printAndFail = (cause: unknown, message: string, exitCode: number) =>
	Console.error(message).pipe(Effect.andThen(Effect.fail(new CliFailure({ cause, exitCode }))));

export const handleCliFailure = {
	ArtifactNotFound: (error: ArtifactNotFound) =>
		printAndFail(error, `Artifact ${error.artifactId} was not found.`, CLI_EXIT_CODES.notFound),
	ArtifactProjectMismatch: (error: ArtifactProjectMismatch) =>
		printAndFail(
			error,
			`Artifact ${error.artifactId} belongs to ${error.artifactProjectId}, not linked Project ${error.linkedProjectId}.`,
			CLI_EXIT_CODES.conflict,
		),
	ArtifactRevisionConflict: (error: ArtifactRevisionConflict) =>
		printAndFail(
			error,
			`Artifact changed: expected ${error.expectedCurrentRevisionId}, current is ${error.currentRevisionId}.`,
			CLI_EXIT_CODES.conflict,
		),
	ConfigFileParseError: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error), CLI_EXIT_CODES.invalidInput),
	ConfigFileReadError: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error), CLI_EXIT_CODES.invalidInput),
	DestructiveConfirmationRequired: (error: DestructiveConfirmationRequired) =>
		printAndFail(
			error,
			`Deletion cancelled for ${error.resourceId}. Use --force for noninteractive deletion.`,
			CLI_EXIT_CODES.invalidInput,
		),
	HttpClientError: (error: HttpClientError) =>
		printAndFail(error, `Artiflow request failed: ${error.message}`, CLI_EXIT_CODES.unavailable),
	IdempotencyConflict: (error: IdempotencyConflict) =>
		printAndFail(
			error,
			`Idempotency key ${error.idempotencyKey} was reused with different content.`,
			CLI_EXIT_CODES.conflict,
		),
	InfrastructureError: (error: InfrastructureError) => printAndFail(error, error.message, CLI_EXIT_CODES.unavailable),
	InvalidArtifactSource: (error: InvalidArtifactSource) =>
		printAndFail(
			error,
			JSON.stringify({ _tag: error._tag, diagnostics: error.diagnostics }),
			CLI_EXIT_CODES.invalidSource,
		),
	InvalidBaseUrl: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error), CLI_EXIT_CODES.invalidInput),
	InvalidConfigPath: (error: Parameters<typeof formatConfigError>[0]) =>
		printAndFail(error, formatConfigError(error), CLI_EXIT_CODES.invalidInput),
	InvalidProjectId: (error: InvalidProjectId) =>
		printAndFail(error, `Invalid Artiflow Project ID: ${error.projectId}.`, CLI_EXIT_CODES.invalidInput),
	InvalidProjectManifest: (error: InvalidProjectManifest) =>
		printAndFail(error, `Invalid Project manifest at ${error.path}: ${error.message}`, CLI_EXIT_CODES.invalidInput),
	InvalidProjectName: (error: InvalidProjectName) => printAndFail(error, error.message, CLI_EXIT_CODES.invalidInput),
	InvalidRequest: (error: InvalidRequest) => printAndFail(error, error.message, CLI_EXIT_CODES.invalidInput),
	ProjectManifestFileError: (error: ProjectManifestFileError) =>
		printAndFail(
			error,
			`Could not access Project manifest at ${error.path}: ${error.message}`,
			CLI_EXIT_CODES.invalidInput,
		),
	ProjectManifestNotFound: (error: ProjectManifestNotFound) =>
		printAndFail(
			error,
			`No .artiflow/project.json found from ${error.startDirectory} to the filesystem root.`,
			CLI_EXIT_CODES.invalidInput,
		),
	ProjectNotFound: (error: ProjectNotFound) =>
		printAndFail(error, `Project ${error.projectId} was not found.`, CLI_EXIT_CODES.notFound),
	SourceFileError: (error: SourceFileError) =>
		printAndFail(
			error,
			`Could not read Artifact Source at ${error.path}: ${error.message}`,
			CLI_EXIT_CODES.invalidInput,
		),
	UnsupportedSourceFormat: (error: UnsupportedSourceFormat) =>
		printAndFail(error, `Source Format ${error.sourceFormatVersion} is not supported.`, CLI_EXIT_CODES.invalidSource),
} as const;
