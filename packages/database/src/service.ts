import { PrismaPg } from "@prisma/adapter-pg";
import { Context, Effect, Layer } from "effect";
import {
	ConnectionUnavailable,
	DatabaseConfigurationError,
	DatabaseConnectionError,
	DatabaseError,
	DatabaseValidationError,
	ForeignKeyConstraintViolation,
	QueryTimedOut,
	RecordRequiredButMissing,
	TransactionWriteConflict,
	UnexpectedDatabaseError,
	UniqueConstraintViolation,
} from "./errors.ts";
import { Prisma, PrismaClient } from "./generated/client.ts";

export type DatabaseOperation = {
	readonly operation: string;
	readonly model?: string;
};

type OperationClient = PrismaClient | Prisma.TransactionClient;

export type TransactionOptions = {
	readonly retries?: number;
};

export type TransactionContext = {
	readonly client: Prisma.TransactionClient;
	readonly query: <A>(
		metadata: DatabaseOperation,
		operation: (client: Prisma.TransactionClient) => PromiseLike<A>,
	) => Effect.Effect<A, DatabaseError>;
	readonly mutation: <A>(
		metadata: DatabaseOperation,
		operation: (client: Prisma.TransactionClient) => PromiseLike<A>,
	) => Effect.Effect<A, DatabaseError>;
};

export class PrismaService extends Context.Service<
	PrismaService,
	{
		readonly client: PrismaClient;
	}
>()("app/PrismaService") {}

export class Database extends Context.Service<
	Database,
	{
		readonly client: PrismaClient;
		readonly query: <A>(
			metadata: DatabaseOperation,
			operation: (client: PrismaClient) => PromiseLike<A>,
		) => Effect.Effect<A, DatabaseError>;
		readonly mutation: <A>(
			metadata: DatabaseOperation,
			operation: (client: PrismaClient) => PromiseLike<A>,
		) => Effect.Effect<A, DatabaseError>;
		readonly transaction: <A, E>(
			metadata: DatabaseOperation,
			operation: (
				transaction: TransactionContext,
			) => Effect.Effect<A, E | DatabaseError>,
			options?: TransactionOptions,
		) => Effect.Effect<A, E | DatabaseError>;
	}
>()("app/Database") {}

export function createPrismaClient(databaseUrl: string): PrismaClient {
	const adapter = new PrismaPg({ connectionString: databaseUrl });

	return new PrismaClient({ adapter });
}

const readDatabaseUrl = Effect.gen(function* () {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		return yield* new DatabaseConfigurationError({
			message: "DATABASE_URL is required",
		});
	}

	let parsed: URL;

	try {
		parsed = new URL(databaseUrl);
	} catch {
		return yield* new DatabaseConfigurationError({
			message: "DATABASE_URL must be a valid URL",
		});
	}

	if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
		return yield* new DatabaseConfigurationError({
			message:
				"DATABASE_URL must use the postgresql:// or postgres:// protocol",
		});
	}

	return databaseUrl;
});

const acquirePrismaClient = readDatabaseUrl.pipe(
	Effect.flatMap((databaseUrl) =>
		Effect.tryPromise({
			try: async () => {
				const client = createPrismaClient(databaseUrl);

				await client.$connect();

				return { client };
			},
			catch: (cause) => new DatabaseConnectionError({ cause }),
		}),
	),
);

function metadataFields(
	metadata: DatabaseOperation,
): Pick<DatabaseOperation, "operation" | "model"> {
	return metadata.model === undefined
		? { operation: metadata.operation }
		: { operation: metadata.operation, model: metadata.model };
}

function stringArray(value: unknown): ReadonlyArray<string> {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === "string");
	}

	if (typeof value === "string") {
		return [value];
	}

	return [];
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

const connectionUnavailableCodes = new Set([
	"P1000",
	"P1001",
	"P1002",
	"P1017",
	"ECONNREFUSED",
	"ECONNRESET",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EPIPE",
]);

const connectionUnavailableMessageFragments = [
	"can't reach database server",
	"cannot reach database server",
	"database server was closed",
	"connection terminated",
	"connection refused",
	"connection reset",
	"server closed the connection",
	"terminating connection",
];

function errorMessage(cause: unknown): string {
	if (cause instanceof Error) {
		return cause.message;
	}

	return typeof cause === "string" ? cause : "";
}

function errorCode(cause: unknown): string | undefined {
	return typeof cause === "object" &&
		cause !== null &&
		"code" in cause &&
		typeof cause.code === "string"
		? cause.code
		: undefined;
}

function isConnectionUnavailableCause(cause: unknown): boolean {
	const code = errorCode(cause);
	if (code !== undefined && connectionUnavailableCodes.has(code)) {
		return true;
	}

	const message = errorMessage(cause).toLowerCase();

	return connectionUnavailableMessageFragments.some((fragment) =>
		message.includes(fragment),
	);
}

function normalizeDatabaseError(
	metadata: DatabaseOperation,
	cause: unknown,
): DatabaseError {
	if (DatabaseError.isDatabaseError(cause)) {
		return cause;
	}

	const base = { ...metadataFields(metadata), cause };

	if (isConnectionUnavailableCause(cause)) {
		return new ConnectionUnavailable(base);
	}

	if (cause instanceof Prisma.PrismaClientKnownRequestError) {
		switch (cause.code) {
			case "P2002":
				return new UniqueConstraintViolation({
					...base,
					constraint: optionalString(cause.meta?.constraint),
					fields: stringArray(cause.meta?.target),
				});
			case "P2003":
				return new ForeignKeyConstraintViolation({
					...base,
					constraint: optionalString(cause.meta?.constraint),
					fields: stringArray(cause.meta?.field_name),
				});
			case "P2024":
				return new QueryTimedOut(base);
			case "P2025":
				return new RecordRequiredButMissing(base);
			case "P2034":
				return new TransactionWriteConflict(base);
			default:
				return new UnexpectedDatabaseError(base);
		}
	}

	if (cause instanceof Prisma.PrismaClientInitializationError) {
		return new ConnectionUnavailable(base);
	}

	if (
		cause instanceof Prisma.PrismaClientUnknownRequestError &&
		isConnectionUnavailableCause(cause)
	) {
		return new ConnectionUnavailable(base);
	}

	if (cause instanceof Prisma.PrismaClientValidationError) {
		return new DatabaseValidationError(base);
	}

	return new UnexpectedDatabaseError(base);
}

function isPrismaDatabaseFailure(cause: unknown): boolean {
	return (
		cause instanceof Prisma.PrismaClientKnownRequestError ||
		cause instanceof Prisma.PrismaClientInitializationError ||
		cause instanceof Prisma.PrismaClientValidationError ||
		cause instanceof Prisma.PrismaClientUnknownRequestError ||
		cause instanceof Prisma.PrismaClientRustPanicError
	);
}

function causeFields(cause: unknown) {
	return {
		causeType: cause instanceof Error ? cause.constructor.name : typeof cause,
		causeCode: errorCode(cause),
		causeMessage: errorMessage(cause),
	};
}

function runOperation<Client extends OperationClient, A>(
	client: Client,
	metadata: DatabaseOperation,
	operation: (client: Client) => PromiseLike<A>,
) {
	return Effect.tryPromise({
		try: () => operation(client),
		catch: (cause) => normalizeDatabaseError(metadata, cause),
	}).pipe(
		Effect.tapError((error) =>
			Effect.gen(function* () {
				const fields = causeFields(error.cause);

				yield* Effect.annotateCurrentSpan({
					"db.error_tag": error._tag,
					"db.cause": error.cause,
					"db.cause_type": fields.causeType,
					"db.cause_code": fields.causeCode ?? "unknown",
					"db.cause_message": fields.causeMessage,
				});

				yield* Effect.logError("Database operation failed").pipe(
					Effect.annotateLogs({
						operation: metadata.operation,
						model: metadata.model,
						errorTag: error._tag,
						retryable: DatabaseError.isRetryable(error),
						causeType: fields.causeType,
						causeCode: fields.causeCode,
						causeMessage: fields.causeMessage,
					}),
				);
			}),
		),
		Effect.withSpan(`Database.${metadata.operation}`, {
			attributes: {
				"db.operation": metadata.operation,
				"db.model": metadata.model ?? "unknown",
			},
		}),
	);
}

function transactionContext(
	client: Prisma.TransactionClient,
): TransactionContext {
	return {
		client,
		query: (metadata, operation) => runOperation(client, metadata, operation),
		mutation: (metadata, operation) =>
			runOperation(client, metadata, operation),
	};
}

function shouldRetryTransaction(error: DatabaseError | unknown): boolean {
	return (
		DatabaseError.isDatabaseError(error) && DatabaseError.isRetryable(error)
	);
}

function normalizeTransactionFailure<E>(
	metadata: DatabaseOperation,
	cause: unknown,
): E | DatabaseError {
	if (DatabaseError.isDatabaseError(cause)) {
		return cause;
	}

	if (!isPrismaDatabaseFailure(cause)) {
		return cause as E;
	}

	return normalizeDatabaseError(metadata, cause);
}

function withTransactionRetries<A, E>(
	effect: Effect.Effect<A, E | DatabaseError>,
	retries: number,
): Effect.Effect<A, E | DatabaseError> {
	return effect.pipe(
		Effect.catchIf(
			() => true,
			(error) => {
				if (retries > 0 && shouldRetryTransaction(error)) {
					return withTransactionRetries(effect, retries - 1);
				}

				return Effect.fail(error);
			},
		),
	);
}

export function makeDatabaseService(client: PrismaClient): Database["Service"] {
	const database: Database["Service"] = {
		client,
		query: (metadata, operation) => runOperation(client, metadata, operation),
		mutation: (metadata, operation) =>
			runOperation(client, metadata, operation),
		transaction: <A, E>(
			metadata: DatabaseOperation,
			operation: (
				transaction: TransactionContext,
			) => Effect.Effect<A, E | DatabaseError>,
			options?: TransactionOptions,
		) => {
			const transaction = Effect.tryPromise({
				try: () =>
					client.$transaction((transactionClient) =>
						Effect.runPromise(operation(transactionContext(transactionClient))),
					),
				catch: (cause) => normalizeTransactionFailure<E>(metadata, cause),
			});

			return withTransactionRetries(transaction, options?.retries ?? 0);
		},
	};

	return database;
}

export const PrismaServiceLive = Layer.effect(
	PrismaService,
	Effect.acquireRelease(acquirePrismaClient, ({ client }) =>
		Effect.promise(() => client.$disconnect()).pipe(Effect.orDie),
	),
);

export const DatabaseLive = Layer.effect(
	Database,
	Effect.gen(function* () {
		const prisma = yield* PrismaService;

		return makeDatabaseService(prisma.client);
	}),
).pipe(Layer.provide(PrismaServiceLive));
