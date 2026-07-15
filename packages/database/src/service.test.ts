import { assert, describe, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import { afterEach } from "vitest";
import type { PrismaClient } from "./generated/client.ts";
import { Prisma } from "./generated/client.ts";
import { DatabaseConfigurationError, DatabaseError } from "./errors.ts";
import {
	makeDatabaseService,
	PrismaService,
	PrismaServiceLive,
} from "./service.ts";

const originalDatabaseUrl = process.env.DATABASE_URL;
const prismaClientVersion = Prisma.prismaVersion.client;

const acquirePrismaService = PrismaService.pipe(
	Effect.provide(PrismaServiceLive),
);

function knownRequestError(
	code: string,
	meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
		code,
		clientVersion: prismaClientVersion,
		meta,
	});
}

class DomainRuleRejected extends Data.TaggedError("DomainRuleRejected")<{
	readonly message: string;
}> {}

describe("PrismaServiceLive configuration", () => {
	afterEach(() => {
		if (originalDatabaseUrl === undefined) {
			delete process.env.DATABASE_URL;
		} else {
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
	});

	it.effect("fails when DATABASE_URL is missing", () =>
		Effect.gen(function* () {
			delete process.env.DATABASE_URL;

			const error = yield* acquirePrismaService.pipe(Effect.flip);

			assert.instanceOf(error, DatabaseConfigurationError);
			assert.strictEqual(error.message, "DATABASE_URL is required");
		}),
	);

	it.effect("fails when DATABASE_URL is not a valid URL", () =>
		Effect.gen(function* () {
			process.env.DATABASE_URL = "not-a-url";

			const error = yield* acquirePrismaService.pipe(Effect.flip);

			assert.instanceOf(error, DatabaseConfigurationError);
			assert.strictEqual(error.message, "DATABASE_URL must be a valid URL");
		}),
	);

	it.effect("fails when DATABASE_URL is not postgres", () =>
		Effect.gen(function* () {
			process.env.DATABASE_URL =
				"mysql://launchkey:launchkey@localhost:3306/app";

			const error = yield* acquirePrismaService.pipe(Effect.flip);

			assert.instanceOf(error, DatabaseConfigurationError);
			assert.strictEqual(
				error.message,
				"DATABASE_URL must use the postgresql:// or postgres:// protocol",
			);
		}),
	);
});

describe("Database query and mutation normalization", () => {
	it.effect("maps unique constraint violations to stable database errors", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);

			const error = yield* database
				.mutation({ operation: "Post.Create", model: "Post" }, () =>
					Promise.reject(knownRequestError("P2002", { target: ["slug"] })),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "UniqueConstraintViolation",
				operation: "Post.Create",
				model: "Post",
			});
			if (error._tag !== "UniqueConstraintViolation") {
				assert.fail("Expected UniqueConstraintViolation");
			}
			assert.deepStrictEqual(error.fields, ["slug"]);
		}),
	);

	it.effect("maps required missing records to stable database errors", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);

			const error = yield* database
				.mutation({ operation: "Post.Update", model: "Post" }, () =>
					Promise.reject(knownRequestError("P2025")),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "RecordRequiredButMissing",
				operation: "Post.Update",
				model: "Post",
			});
		}),
	);

	it.effect("maps foreign key constraint violations with affected fields", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);

			const error = yield* database
				.mutation({ operation: "Comment.Create", model: "Comment" }, () =>
					Promise.reject(
						knownRequestError("P2003", {
							field_name: "post_id",
							constraint: "comments_post_id_fkey",
						}),
					),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "ForeignKeyConstraintViolation",
				operation: "Comment.Create",
				model: "Comment",
				constraint: "comments_post_id_fkey",
			});
			if (error._tag !== "ForeignKeyConstraintViolation") {
				assert.fail("Expected ForeignKeyConstraintViolation");
			}
			assert.deepStrictEqual(error.fields, ["post_id"]);
		}),
	);

	it.effect("maps connection pool timeouts as retryable query timeouts", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);

			const error = yield* database
				.query({ operation: "Post.List", model: "Post" }, () =>
					Promise.reject(knownRequestError("P2024")),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "QueryTimedOut",
				operation: "Post.List",
				model: "Post",
			});
			assert.isTrue(DatabaseError.isRetryable(error));
		}),
	);

	it.effect(
		"maps Prisma validation errors without leaking Prisma control flow",
		() =>
			Effect.gen(function* () {
				const database = makeDatabaseService({} as PrismaClient);

				const error = yield* database
					.mutation({ operation: "Post.Create", model: "Post" }, () =>
						Promise.reject(
							new Prisma.PrismaClientValidationError("invalid query", {
								clientVersion: prismaClientVersion,
							}),
						),
					)
					.pipe(Effect.flip);

				assert.include(error, {
					_tag: "DatabaseValidationError",
					operation: "Post.Create",
					model: "Post",
				});
			}),
	);

	it.effect(
		"maps unexpected Prisma request failures to unexpected database errors",
		() =>
			Effect.gen(function* () {
				const database = makeDatabaseService({} as PrismaClient);

				const error = yield* database
					.query({ operation: "Post.List", model: "Post" }, () =>
						Promise.reject(knownRequestError("P2999")),
					)
					.pipe(Effect.flip);

				assert.include(error, {
					_tag: "UnexpectedDatabaseError",
					operation: "Post.List",
					model: "Post",
				});
			}),
	);
});

describe("Database connectivity normalization", () => {
	it.effect("maps Prisma initialization errors as connection unavailable", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);

			const error = yield* database
				.query({ operation: "Post.List", model: "Post" }, () =>
					Promise.reject(
						new Prisma.PrismaClientInitializationError(
							"database unavailable",
							prismaClientVersion,
						),
					),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "ConnectionUnavailable",
				operation: "Post.List",
				model: "Post",
			});
		}),
	);

	it.effect(
		"maps Prisma connection request errors as connection unavailable",
		() =>
			Effect.gen(function* () {
				const database = makeDatabaseService({} as PrismaClient);

				const error = yield* database
					.query({ operation: "Post.List", model: "Post" }, () =>
						Promise.reject(knownRequestError("P1001")),
					)
					.pipe(Effect.flip);

				assert.include(error, {
					_tag: "ConnectionUnavailable",
					operation: "Post.List",
					model: "Post",
				});
			}),
	);

	it.effect(
		"maps Prisma known request network errors as connection unavailable",
		() =>
			Effect.gen(function* () {
				const database = makeDatabaseService({} as PrismaClient);

				const error = yield* database
					.query({ operation: "Post.List", model: "Post" }, () =>
						Promise.reject(knownRequestError("ECONNREFUSED")),
					)
					.pipe(Effect.flip);

				assert.include(error, {
					_tag: "ConnectionUnavailable",
					operation: "Post.List",
					model: "Post",
				});
			}),
	);

	it.effect(
		"maps runtime Prisma connection loss as connection unavailable",
		() =>
			Effect.gen(function* () {
				const database = makeDatabaseService({} as PrismaClient);

				const error = yield* database
					.mutation({ operation: "Post.Delete", model: "Post" }, () =>
						Promise.reject(
							new Prisma.PrismaClientUnknownRequestError(
								"Connection terminated unexpectedly",
								{ clientVersion: prismaClientVersion },
							),
						),
					)
					.pipe(Effect.flip);

				assert.include(error, {
					_tag: "ConnectionUnavailable",
					operation: "Post.Delete",
					model: "Post",
				});
			}),
	);

	it.effect("maps driver network errors as connection unavailable", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);
			const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1"), {
				code: "ECONNREFUSED",
			});

			const error = yield* database
				.query({ operation: "Post.List", model: "Post" }, () =>
					Promise.reject(cause),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "ConnectionUnavailable",
				operation: "Post.List",
				model: "Post",
			});
		}),
	);
});

describe("Database transaction behavior", () => {
	it.effect(
		"retries transaction write conflicts only when retries are requested",
		() =>
			Effect.gen(function* () {
				let attempts = 0;
				const client = {
					$transaction: (
						callback: (client: Prisma.TransactionClient) => Promise<string>,
					) => {
						attempts += 1;
						return callback({} as Prisma.TransactionClient);
					},
				} as unknown as PrismaClient;
				const database = makeDatabaseService(client);

				const result = yield* database.transaction(
					{ operation: "Post.Publish", model: "Post" },
					(transaction) =>
						transaction.mutation(
							{ operation: "Post.Update", model: "Post" },
							() =>
								attempts === 1
									? Promise.reject(knownRequestError("P2034"))
									: Promise.resolve("published"),
						),
					{ retries: 1 },
				);

				assert.strictEqual(result, "published");
				assert.strictEqual(attempts, 2);
			}),
	);

	it.effect("does not retry transaction write conflicts by default", () =>
		Effect.gen(function* () {
			let attempts = 0;
			const client = {
				$transaction: (
					callback: (client: Prisma.TransactionClient) => Promise<string>,
				) => {
					attempts += 1;
					return callback({} as Prisma.TransactionClient);
				},
			} as unknown as PrismaClient;
			const database = makeDatabaseService(client);

			const error = yield* database
				.transaction(
					{ operation: "Post.Publish", model: "Post" },
					(transaction) =>
						transaction.mutation(
							{ operation: "Post.Update", model: "Post" },
							() => Promise.reject(knownRequestError("P2034")),
						),
				)
				.pipe(Effect.flip);

			assert.include(error, {
				_tag: "TransactionWriteConflict",
				operation: "Post.Update",
				model: "Post",
			});
			assert.strictEqual(attempts, 1);
		}),
	);

	it.effect(
		"passes through non-database transaction failures from the callback",
		() =>
			Effect.gen(function* () {
				const client = {
					$transaction: (
						callback: (client: Prisma.TransactionClient) => Promise<never>,
					) => callback({} as Prisma.TransactionClient),
				} as unknown as PrismaClient;
				const database = makeDatabaseService(client);

				const error = yield* database
					.transaction({ operation: "Post.Publish", model: "Post" }, () =>
						Effect.fail(
							new DomainRuleRejected({
								message: "post is already published",
							}),
						),
					)
					.pipe(Effect.flip);

				assert.instanceOf(error, DomainRuleRejected);
			}),
	);
});

describe("DatabaseError predicates", () => {
	it.effect("identifies retryable and constraint database errors", () =>
		Effect.gen(function* () {
			const database = makeDatabaseService({} as PrismaClient);
			const retryable = yield* database
				.query({ operation: "Post.Get", model: "Post" }, () =>
					Promise.reject(knownRequestError("P2034")),
				)
				.pipe(Effect.flip);
			const constraint = yield* database
				.mutation({ operation: "Post.Create", model: "Post" }, () =>
					Promise.reject(knownRequestError("P2002", { target: ["slug"] })),
				)
				.pipe(Effect.flip);

			assert.isTrue(DatabaseError.isDatabaseError(retryable));
			assert.isTrue(DatabaseError.isRetryable(retryable));
			assert.isTrue(DatabaseError.isConstraintViolation(constraint));
		}),
	);
});
