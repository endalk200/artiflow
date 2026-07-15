import { Data } from "effect";

export class DatabaseConfigurationError extends Data.TaggedError(
	"DatabaseConfigurationError",
)<{
	readonly message: string;
}> {}

export class DatabaseConnectionError extends Data.TaggedError(
	"DatabaseConnectionError",
)<{
	readonly cause: unknown;
}> {}

export class UniqueConstraintViolation extends Data.TaggedError(
	"UniqueConstraintViolation",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly constraint?: string;
	readonly fields: ReadonlyArray<string>;
	readonly cause: unknown;
}> {}

export class ForeignKeyConstraintViolation extends Data.TaggedError(
	"ForeignKeyConstraintViolation",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly constraint?: string;
	readonly fields: ReadonlyArray<string>;
	readonly cause: unknown;
}> {}

export class RecordRequiredButMissing extends Data.TaggedError(
	"RecordRequiredButMissing",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly cause: unknown;
}> {}

export class TransactionWriteConflict extends Data.TaggedError(
	"TransactionWriteConflict",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly cause: unknown;
}> {}

export class ConnectionUnavailable extends Data.TaggedError(
	"ConnectionUnavailable",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly cause: unknown;
}> {}

export class QueryTimedOut extends Data.TaggedError("QueryTimedOut")<{
	readonly operation: string;
	readonly model?: string;
	readonly cause: unknown;
}> {}

export class DatabaseValidationError extends Data.TaggedError(
	"DatabaseValidationError",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly cause: unknown;
}> {}

export class UnexpectedDatabaseError extends Data.TaggedError(
	"UnexpectedDatabaseError",
)<{
	readonly operation: string;
	readonly model?: string;
	readonly cause: unknown;
}> {}

export type DatabaseError =
	| UniqueConstraintViolation
	| ForeignKeyConstraintViolation
	| RecordRequiredButMissing
	| TransactionWriteConflict
	| ConnectionUnavailable
	| QueryTimedOut
	| DatabaseValidationError
	| UnexpectedDatabaseError;

const databaseErrorTags = new Set<DatabaseError["_tag"]>([
	"UniqueConstraintViolation",
	"ForeignKeyConstraintViolation",
	"RecordRequiredButMissing",
	"TransactionWriteConflict",
	"ConnectionUnavailable",
	"QueryTimedOut",
	"DatabaseValidationError",
	"UnexpectedDatabaseError",
]);

export const DatabaseError = {
	isDatabaseError: (error: unknown): error is DatabaseError =>
		typeof error === "object" &&
		error !== null &&
		"_tag" in error &&
		typeof error._tag === "string" &&
		databaseErrorTags.has(error._tag as DatabaseError["_tag"]),
	isConstraintViolation: (
		error: DatabaseError,
	): error is UniqueConstraintViolation | ForeignKeyConstraintViolation =>
		error._tag === "UniqueConstraintViolation" ||
		error._tag === "ForeignKeyConstraintViolation",
	isRetryable: (error: DatabaseError): boolean =>
		error._tag === "TransactionWriteConflict" ||
		error._tag === "ConnectionUnavailable" ||
		error._tag === "QueryTimedOut",
};
