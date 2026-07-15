import { Schema } from "effect";

export class PostOperationFailedError extends Schema.TaggedErrorClass<PostOperationFailedError>()(
	"PostOperationFailed",
	{
		operation: Schema.String,
		message: Schema.String,
		retryable: Schema.Boolean,
	},
) {}

export class PostNotFoundError extends Schema.TaggedErrorClass<PostNotFoundError>()(
	"PostNotFound",
	{
		id: Schema.String,
		message: Schema.String,
	},
) {}

export class PostAlreadyExistsError extends Schema.TaggedErrorClass<PostAlreadyExistsError>()(
	"PostAlreadyExists",
	{
		id: Schema.String,
		message: Schema.String,
	},
) {}
