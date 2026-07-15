import { AuthMiddleware } from "@app/auth/rpc";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import {
	PostNotFoundError,
	PostOperationFailedError,
} from "../model/errors.ts";
import { Post } from "../model/post.ts";

const PostId = Schema.String.check(Schema.isUUID());

const requiredString = (label: string) =>
	Schema.String.check(
		Schema.makeFilter(
			(value) => value.trim().length > 0 || `${label} is required.`,
		),
	);

export class ListPostsRPC extends Rpc.make("Post.List", {
	success: Schema.Array(Post),
	error: Schema.Union([PostNotFoundError, PostOperationFailedError]),
}) {}

export class CreatePostRPC extends Rpc.make("Post.Create", {
	payload: Schema.Struct({
		title: requiredString("Title"),
		content: requiredString("Content"),
	}),
	success: Post,
	error: Schema.Union([PostNotFoundError, PostOperationFailedError]),
}) {}

export class DeletePostRPC extends Rpc.make("Post.Delete", {
	payload: Schema.Struct({
		id: PostId,
	}),
	success: Post,
	error: Schema.Union([PostNotFoundError, PostOperationFailedError]),
}) {}

export class UpdatePostRPC extends Rpc.make("Post.Update", {
	payload: Schema.Struct({
		id: PostId,
		title: requiredString("Title"),
		content: requiredString("Content"),
	}),
	success: Post,
	error: Schema.Union([PostNotFoundError, PostOperationFailedError]),
}) {}

class PostRpcs extends RpcGroup.make(
	ListPostsRPC,
	CreatePostRPC,
	DeletePostRPC,
	UpdatePostRPC,
).middleware(AuthMiddleware) {}

export { PostRpcs };
