import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
	CreatePostRPC,
	DeletePostRPC,
	UpdatePostRPC,
} from "./post.rpc.definition.ts";

describe("Post RPC definitions", () => {
	it.effect("accepts valid create payloads", () =>
		Effect.sync(() => {
			const payload = Schema.decodeUnknownSync(CreatePostRPC.payloadSchema)({
				title: "Created post",
				content: "Created body",
			});

			assert.deepStrictEqual(payload, {
				title: "Created post",
				content: "Created body",
			});
		}),
	);

	it.effect("rejects empty create titles", () =>
		Effect.sync(() => {
			assert.throws(
				() =>
					Schema.decodeUnknownSync(CreatePostRPC.payloadSchema)({
						title: "   ",
						content: "Created body",
					}),
				/Title is required\./,
			);
		}),
	);

	it.effect("rejects empty create content", () =>
		Effect.sync(() => {
			assert.throws(
				() =>
					Schema.decodeUnknownSync(CreatePostRPC.payloadSchema)({
						title: "Created post",
						content: "   ",
					}),
				/Content is required\./,
			);
		}),
	);

	it.effect("accepts valid update payloads", () =>
		Effect.sync(() => {
			const payload = Schema.decodeUnknownSync(UpdatePostRPC.payloadSchema)({
				id: "00000000-0000-4000-8000-000000000001",
				title: "Updated post",
				content: "Updated body",
			});

			assert.deepStrictEqual(payload, {
				id: "00000000-0000-4000-8000-000000000001",
				title: "Updated post",
				content: "Updated body",
			});
		}),
	);

	it.effect("rejects invalid update ids", () =>
		Effect.sync(() => {
			assert.throws(
				() =>
					Schema.decodeUnknownSync(UpdatePostRPC.payloadSchema)({
						id: "not-a-uuid",
						title: "Updated post",
						content: "Updated body",
					}),
				/Expected a UUID/,
			);
		}),
	);

	it.effect("rejects invalid delete ids", () =>
		Effect.sync(() => {
			assert.throws(
				() =>
					Schema.decodeUnknownSync(DeletePostRPC.payloadSchema)({
						id: "not-a-uuid",
					}),
				/Expected a UUID/,
			);
		}),
	);
});
