import { AuthenticatedUser } from "@app/auth/rpc";
import { Effect } from "effect";
import { PostRpcs } from "./post.rpc.definition.ts";
import { PostService } from "./post.service.ts";

const PostHandlers = PostRpcs.toLayer(
	Effect.gen(function* () {
		const posts = yield* PostService;

		return PostRpcs.of({
			"Post.List": Effect.fn("Post.List")(function* () {
				const user = yield* AuthenticatedUser;
				const list = yield* posts.list(user.id);

				return list;
			}),
			"Post.Create": Effect.fn("Post.Create")(function* (payload) {
				const user = yield* AuthenticatedUser;
				const post = yield* posts.create({
					userId: user.id,
					title: payload.title,
					content: payload.content,
				});

				return post;
			}),
			"Post.Update": Effect.fn("Post.Update")(function* (payload) {
				const user = yield* AuthenticatedUser;
				const post = yield* posts.update({
					userId: user.id,
					id: payload.id,
					title: payload.title,
					content: payload.content,
				});

				return post;
			}),
			"Post.Delete": Effect.fn("Post.Delete")(function* (payload) {
				const user = yield* AuthenticatedUser;
				const post = yield* posts.delete({
					userId: user.id,
					id: payload.id,
				});

				return post;
			}),
		});
	}),
);

export { PostHandlers };
