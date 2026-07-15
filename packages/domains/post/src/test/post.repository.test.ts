import { Database, DatabaseLive } from "@app/database";
import { assert, describe, it } from "@effect/vitest";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect, Layer } from "effect";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { PostNotFoundError } from "../model/errors.ts";
import { Post } from "../model/post.ts";
import {
	PostRepository,
	PostRepositoryPrisma,
} from "../server/post.repository.ts";

let container: StartedPostgreSqlContainer;
const rootDirectory = fileURLToPath(new URL("../../../../..", import.meta.url));
const originalDatabaseUrl = process.env.DATABASE_URL;
const userId = "user-1";
const otherUserId = "user-2";

function assertDockerRuntime() {
	try {
		execFileSync("docker", ["info"], { stdio: "ignore" });
	} catch (cause) {
		throw new Error(
			"Docker is required to run post repository integration tests.",
			{ cause },
		);
	}
}

function runRepository<A, E>(effect: Effect.Effect<A, E, PostRepository>) {
	return effect.pipe(
		Effect.provide(PostRepositoryPrisma.pipe(Layer.provide(DatabaseLive))),
	);
}

function runWithDatabase<A, E>(effect: Effect.Effect<A, E, Database>) {
	return Effect.runPromise(effect.pipe(Effect.provide(DatabaseLive)));
}

describe("PostRepositoryPrisma integration", () => {
	beforeAll(async () => {
		assertDockerRuntime();

		container = await new PostgreSqlContainer("postgres:17-alpine")
			.withDatabase("launchkey_test")
			.withUsername("launchkey")
			.withPassword("launchkey")
			.start();

		process.env.DATABASE_URL = `${container.getConnectionUri()}?schema=public`;

		execFileSync("bun", ["--filter", "@app/database", "db:migrate:deploy"], {
			cwd: rootDirectory,
			env: process.env,
			stdio: "inherit",
		});
	});

	afterAll(async () => {
		if (originalDatabaseUrl === undefined) {
			delete process.env.DATABASE_URL;
		} else {
			process.env.DATABASE_URL = originalDatabaseUrl;
		}

		await container?.stop();
	});

	beforeEach(async () => {
		await runWithDatabase(
			Effect.gen(function* () {
				const database = yield* Database;

				yield* database
					.mutation({ operation: "PostTest.Reset", model: "Post" }, (client) =>
						client.$executeRawUnsafe('TRUNCATE TABLE "posts", "user" CASCADE'),
					)
					.pipe(Effect.orDie);

				yield* database
					.mutation(
						{ operation: "PostTest.SeedUsers", model: "User" },
						(client) =>
							client.user.createMany({
								data: [
									{
										id: userId,
										name: "User One",
										email: "user-1@example.com",
										emailVerified: true,
									},
									{
										id: otherUserId,
										name: "User Two",
										email: "user-2@example.com",
										emailVerified: true,
									},
								],
							}),
					)
					.pipe(Effect.orDie);
			}),
		);
	});

	it.effect("creates and lists posts through the PostRepository contract", () =>
		Effect.gen(function* () {
			const repo = yield* PostRepository;
			const first = yield* repo.create(userId, "First post", "First body");
			const second = yield* repo.create(userId, "Second post", "Second body");
			const list = yield* repo.list(userId);

			assert.match(first.id, /^[0-9a-f-]{36}$/);
			assert.deepStrictEqual(list, [first, second]);
		}).pipe(runRepository),
	);

	it.effect("updates posts through the PostRepository contract", () =>
		Effect.gen(function* () {
			const repo = yield* PostRepository;
			const created = yield* repo.create(userId, "First post", "First body");

			const result = yield* repo.update(
				userId,
				created.id,
				"Updated post",
				"Updated body",
			);

			assert.deepStrictEqual(
				result,
				new Post({
					id: created.id,
					title: "Updated post",
					content: "Updated body",
				}),
			);
		}).pipe(runRepository),
	);

	it.effect("deletes posts through the PostRepository contract", () =>
		Effect.gen(function* () {
			const repo = yield* PostRepository;
			const created = yield* repo.create(userId, "First post", "First body");
			const deleted = yield* repo.delete(userId, created.id);
			const list = yield* repo.list(userId);

			assert.deepStrictEqual(deleted, created);
			assert.deepStrictEqual(list, []);
		}).pipe(runRepository),
	);

	it.effect("does not list or modify posts owned by another user", () =>
		Effect.gen(function* () {
			const repo = yield* PostRepository;
			const owned = yield* repo.create(userId, "Owned post", "Owned body");
			const other = yield* repo.create(otherUserId, "Other post", "Other body");
			const list = yield* repo.list(userId);

			const updateError = yield* repo
				.update(userId, other.id, "Updated post", "Updated body")
				.pipe(Effect.flip);
			const deleteError = yield* repo
				.delete(userId, other.id)
				.pipe(Effect.flip);

			assert.deepStrictEqual(list, [owned]);
			assert.instanceOf(updateError, PostNotFoundError);
			assert.instanceOf(deleteError, PostNotFoundError);
		}).pipe(runRepository),
	);

	it.effect("returns PostNotFound when updating a missing post", () =>
		Effect.gen(function* () {
			const repo = yield* PostRepository;

			const error = yield* repo
				.update(
					userId,
					"00000000-0000-0000-0000-000000000001",
					"Updated post",
					"Updated body",
				)
				.pipe(Effect.flip);

			assert.instanceOf(error, PostNotFoundError);
			assert.strictEqual(error.id, "00000000-0000-0000-0000-000000000001");
		}).pipe(runRepository),
	);

	it.effect("returns PostNotFound when deleting a missing post", () =>
		Effect.gen(function* () {
			const repo = yield* PostRepository;

			const error = yield* repo
				.delete(userId, "00000000-0000-0000-0000-000000000001")
				.pipe(Effect.flip);

			assert.instanceOf(error, PostNotFoundError);
			assert.strictEqual(error.id, "00000000-0000-0000-0000-000000000001");
		}).pipe(runRepository),
	);
});
