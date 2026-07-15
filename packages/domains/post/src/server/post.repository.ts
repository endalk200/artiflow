import { Database, DatabaseError } from "@app/database";
import { Context, Effect, Layer } from "effect";
import { Post } from "../model/post.ts";
import { PostNotFoundError } from "../model/errors.ts";

class PostRepository extends Context.Service<
	PostRepository,
	{
		readonly list: (
			userId: string,
		) => Effect.Effect<ReadonlyArray<Post>, DatabaseError>;
		readonly create: (
			userId: string,
			title: string,
			content: string,
		) => Effect.Effect<Post, DatabaseError>;
		readonly delete: (
			userId: string,
			id: string,
		) => Effect.Effect<Post, DatabaseError | PostNotFoundError>;
		readonly update: (
			userId: string,
			id: string,
			title: string,
			content: string,
		) => Effect.Effect<Post, DatabaseError | PostNotFoundError>;
	}
>()("app/PostRepo") {}

const PostRepositoryPrisma = Layer.effect(
	PostRepository,
	Effect.gen(function* () {
		const database = yield* Database;

		return PostRepository.of({
			list: (userId) =>
				Effect.fn("PostRepository.List")(function* () {
					const records = yield* database.query(
						{ operation: "Post.List", model: "Post" },
						(client) =>
							client.post.findMany({
								where: { userId },
								orderBy: { createdAt: "asc" },
							}),
					);

					const posts = records.map(
						(record) =>
							new Post({
								id: record.id,
								title: record.title,
								content: record.content,
							}),
					);

					return posts;
				})(),

			create: (userId, title, content) =>
				Effect.fn("PostRepository.Create")(function* () {
					const record = yield* database.mutation(
						{ operation: "Post.Create", model: "Post" },
						(client) =>
							client.post.create({ data: { userId, title, content } }),
					);

					const post = new Post({
						id: record.id,
						title: record.title,
						content: record.content,
					});

					return post;
				})(),

			delete: (userId, id) =>
				Effect.fn("PostRepository.Delete")(function* () {
					const record = yield* database
						.mutation({ operation: "Post.Delete", model: "Post" }, (client) =>
							client.post.delete({
								where: { id_userId: { id, userId } },
							}),
						)
						.pipe(
							Effect.catchIf(
								(error) => error._tag === "RecordRequiredButMissing",
								() =>
									Effect.fail(
										new PostNotFoundError({
											id,
											message: "Post not found",
										}),
									),
							),
						);

					const post = new Post({
						id: record.id,
						title: record.title,
						content: record.content,
					});

					return post;
				})(),

			update: (userId, id, title, content) =>
				Effect.fn("PostRepository.Update")(function* () {
					const record = yield* database
						.mutation({ operation: "Post.Update", model: "Post" }, (client) =>
							client.post.update({
								where: { id_userId: { id, userId } },
								data: { title, content },
							}),
						)
						.pipe(
							Effect.catchIf(
								(error) => error._tag === "RecordRequiredButMissing",
								() =>
									Effect.fail(
										new PostNotFoundError({
											id,
											message: "Post not found",
										}),
									),
							),
						);

					const post = new Post({
						id: record.id,
						title: record.title,
						content: record.content,
					});

					return post;
				})(),
		});
	}),
);

export { PostRepository, PostRepositoryPrisma };
