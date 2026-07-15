import { Schema } from "effect";

export class Post extends Schema.Class<Post>("Post")({
	id: Schema.String,
	title: Schema.String,
	content: Schema.String,
}) {}
