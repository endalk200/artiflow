import { makeTestAuthMiddlewareLayer } from "@app/auth/rpc";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { PostNotFoundError } from "../model/errors.ts";
import { Post } from "../model/post.ts";
import { PostRpcs } from "./post.rpc.definition.ts";
import { PostHandlers } from "./post.rpc.handler.ts";
import { PostService } from "./post.service.ts";

const existingPost = new Post({
	id: "00000000-0000-0000-0000-000000000001",
	title: "First post",
	content: "First body",
});
const testUser = {
	id: "user-1",
	email: "user-1@example.com",
	name: "User One",
};

function postServiceLayer(overrides: Partial<PostService["Service"]> = {}) {
	return Layer.succeed(
		PostService,
		PostService.of({
			list: () => Effect.succeed([existingPost]),
			create: ({ title, content }) =>
				Effect.succeed(
					new Post({
						id: "00000000-0000-0000-0000-000000000002",
						title,
						content,
					}),
				),
			update: ({ id, title, content }) =>
				Effect.succeed(
					new Post({
						id,
						title,
						content,
					}),
				),
			delete: ({ id }) =>
				Effect.succeed(
					new Post({
						id,
						title: "Deleted post",
						content: "Deleted body",
					}),
				),
			...overrides,
		}),
	);
}

function runRpc<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	layer = postServiceLayer(),
) {
	const authLayer = makeTestAuthMiddlewareLayer(testUser);

	return Effect.scoped(effect).pipe(
		Effect.provide(
			PostHandlers.pipe(Layer.provide(layer), Layer.provide(authLayer)),
		),
		Effect.provide(authLayer),
	);
}

describe("PostHandlers", () => {
	it.effect("returns posts from Post.List", () =>
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(PostRpcs);

			const result = yield* client["Post.List"]();

			assert.deepStrictEqual(result, [existingPost]);
		}).pipe(runRpc),
	);

	it.effect("passes Post.Create payload to the service", () =>
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(PostRpcs);

			const result = yield* client["Post.Create"]({
				title: "Created post",
				content: "Created body",
			});

			assert.deepStrictEqual(
				result,
				new Post({
					id: "00000000-0000-0000-0000-000000000002",
					title: "Created post",
					content: "Created body",
				}),
			);
		}).pipe(runRpc),
	);

	it.effect("passes Post.Update payload to the service", () =>
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(PostRpcs);

			const result = yield* client["Post.Update"]({
				id: "00000000-0000-4000-8000-000000000003",
				title: "Updated post",
				content: "Updated body",
			});

			assert.deepStrictEqual(
				result,
				new Post({
					id: "00000000-0000-4000-8000-000000000003",
					title: "Updated post",
					content: "Updated body",
				}),
			);
		}).pipe(runRpc),
	);

	it.effect("passes Post.Delete payload to the service", () =>
		Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(PostRpcs);

			const result = yield* client["Post.Delete"]({
				id: "00000000-0000-4000-8000-000000000004",
			});

			assert.deepStrictEqual(
				result,
				new Post({
					id: "00000000-0000-4000-8000-000000000004",
					title: "Deleted post",
					content: "Deleted body",
				}),
			);
		}).pipe(runRpc),
	);

	it.effect("propagates typed service errors", () => {
		const missing = new PostNotFoundError({
			id: "00000000-0000-4000-8000-000000000009",
			message: "Post not found",
		});

		return Effect.gen(function* () {
			const client = yield* RpcTest.makeClient(PostRpcs);

			const error = yield* client["Post.Update"]({
				id: "00000000-0000-4000-8000-000000000009",
				title: "Updated post",
				content: "Updated body",
			}).pipe(Effect.flip);

			assert.strictEqual(error, missing);
		}).pipe((effect) =>
			runRpc(
				effect,
				postServiceLayer({
					update: () => Effect.fail(missing),
				}),
			),
		);
	});
});
