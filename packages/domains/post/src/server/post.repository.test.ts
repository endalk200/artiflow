import {
	Database,
	RecordRequiredButMissing,
	TransactionWriteConflict,
	UnexpectedDatabaseError,
} from "@app/database";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { PostNotFoundError } from "../model/errors.ts";
import { PostRepository, PostRepositoryPrisma } from "./post.repository.ts";

const fakeDatabaseClient = {} as Database["Service"]["client"];
const userId = "user-1";

function runRepositoryWithDatabase<A, E>(
	database: Database["Service"],
	effect: Effect.Effect<A, E, PostRepository>,
) {
	return effect.pipe(
		Effect.provide(
			PostRepositoryPrisma.pipe(
				Layer.provide(Layer.succeed(Database, database)),
			),
		),
	);
}

describe("PostRepositoryPrisma database error handling", () => {
	it.effect("propagates unexpected database failures", () =>
		Effect.gen(function* () {
			const database = Database.of({
				client: fakeDatabaseClient,
				query: (metadata) =>
					Effect.fail(
						new UnexpectedDatabaseError({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("database failed"),
						}),
					),
				mutation: (metadata) =>
					Effect.fail(
						new UnexpectedDatabaseError({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("database failed"),
						}),
					),
				transaction: (metadata) =>
					Effect.fail(
						new UnexpectedDatabaseError({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("database failed"),
						}),
					),
			});

			const error = yield* runRepositoryWithDatabase(
				database,
				Effect.gen(function* () {
					const repo = yield* PostRepository;

					return yield* repo.list(userId);
				}),
			).pipe(Effect.flip);

			assert.include(error, {
				_tag: "UnexpectedDatabaseError",
				operation: "Post.List",
			});
		}),
	);

	it.effect("propagates retryable database failures", () =>
		Effect.gen(function* () {
			const database = Database.of({
				client: fakeDatabaseClient,
				query: (metadata) =>
					Effect.fail(
						new TransactionWriteConflict({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("write conflict"),
						}),
					),
				mutation: (metadata) =>
					Effect.fail(
						new TransactionWriteConflict({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("write conflict"),
						}),
					),
				transaction: (metadata) =>
					Effect.fail(
						new TransactionWriteConflict({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("write conflict"),
						}),
					),
			});

			const error = yield* runRepositoryWithDatabase(
				database,
				Effect.gen(function* () {
					const repo = yield* PostRepository;

					return yield* repo.create(userId, "First post", "First body");
				}),
			).pipe(Effect.flip);

			assert.include(error, {
				_tag: "TransactionWriteConflict",
				operation: "Post.Create",
			});
		}),
	);

	it.effect("translates missing updates to PostNotFound", () =>
		Effect.gen(function* () {
			const id = "00000000-0000-0000-0000-000000000009";
			const database = Database.of({
				client: fakeDatabaseClient,
				query: () => Effect.die("unexpected query"),
				mutation: (metadata) =>
					Effect.fail(
						new RecordRequiredButMissing({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("missing record"),
						}),
					),
				transaction: () => Effect.die("unexpected transaction"),
			});

			const error = yield* runRepositoryWithDatabase(
				database,
				Effect.gen(function* () {
					const repo = yield* PostRepository;

					return yield* repo.update(userId, id, "Updated post", "Updated body");
				}),
			).pipe(Effect.flip);

			assert.instanceOf(error, PostNotFoundError);
			assert.strictEqual(error.id, id);
		}),
	);

	it.effect("translates missing deletes to PostNotFound", () =>
		Effect.gen(function* () {
			const id = "00000000-0000-0000-0000-000000000009";
			const database = Database.of({
				client: fakeDatabaseClient,
				query: () => Effect.die("unexpected query"),
				mutation: (metadata) =>
					Effect.fail(
						new RecordRequiredButMissing({
							operation: metadata.operation,
							model: metadata.model,
							cause: new Error("missing record"),
						}),
					),
				transaction: () => Effect.die("unexpected transaction"),
			});

			const error = yield* runRepositoryWithDatabase(
				database,
				Effect.gen(function* () {
					const repo = yield* PostRepository;

					return yield* repo.delete(userId, id);
				}),
			).pipe(Effect.flip);

			assert.instanceOf(error, PostNotFoundError);
			assert.strictEqual(error.id, id);
		}),
	);
});
