"use client";

import {
	useCreatePost,
	useDeletePost,
	usePosts,
	useUpdatePost,
} from "../client/hooks.ts";
import { PostList } from "./list.tsx";

export function PostListController() {
	const postsQuery = usePosts();
	const createPost = useCreatePost();
	const updatePost = useUpdatePost();
	const deletePost = useDeletePost();

	const isPending =
		createPost.isPending || updatePost.isPending || deletePost.isPending;

	return (
		<PostList
			posts={postsQuery.data ?? []}
			isLoading={postsQuery.isLoading}
			isPending={isPending}
			onCreatePost={(input) => createPost.mutateAsync(input)}
			onDeletePost={(id) => deletePost.mutateAsync(id)}
			onUpdatePost={(input) => updatePost.mutateAsync(input)}
		/>
	);
}
