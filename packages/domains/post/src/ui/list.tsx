"use client";

import { DeletePostDialog } from "./delete-dialog.tsx";
import { PostDetail } from "./detail.tsx";
import { PostEmptyState } from "./empty-state.tsx";
import { PostForm } from "./form.tsx";
import { PostListHeader } from "./header.tsx";
import { PostListLoading } from "./loading.tsx";
import type { PostFormValue, PostListPost } from "./types.ts";
import { usePostListState } from "./state.ts";
import { PostTable } from "./table.tsx";

export function PostList({
	posts,
	isLoading,
	isPending,
	onCreatePost,
	onUpdatePost,
	onDeletePost,
}: {
	posts: ReadonlyArray<PostListPost>;
	isLoading: boolean;
	isPending: boolean;
	onCreatePost: (input: { title: string; content: string }) => Promise<unknown>;
	onUpdatePost: (input: {
		id: string;
		title: string;
		content: string;
	}) => Promise<unknown>;
	onDeletePost: (id: string) => Promise<unknown>;
}) {
	const state = usePostListState(posts);

	async function submitPost(value: PostFormValue) {
		if (state.screen === "edit" && state.selectedPostId) {
			await onUpdatePost({ id: state.selectedPostId, ...value });
			if (state.selectedPost) {
				state.showView({ ...state.selectedPost, ...value });
			}
			return;
		}

		await onCreatePost(value);
		state.showList();
	}

	async function confirmDelete() {
		if (!state.deleteTarget) {
			return;
		}

		await onDeletePost(state.deleteTarget.id);
		if (state.selectedPostId === state.deleteTarget.id) {
			state.showList();
		}
		state.setDeleteTarget(null);
	}

	return (
		<div className="overflow-hidden rounded-lg border border-[#dfe3ea] bg-white shadow-sm">
			<PostListHeader onCreate={state.showCreate} />

			{state.screen === "create" ? (
				<PostForm
					initialValue={state.initialPostFormValue}
					isEditing={false}
					isPending={isPending}
					onCancel={state.showList}
					onSubmit={submitPost}
				/>
			) : null}

			{state.screen === "edit" && state.selectedPost ? (
				<PostForm
					initialValue={{
						title: state.selectedPost.title,
						content: state.selectedPost.content,
					}}
					isEditing
					isPending={isPending}
					onCancel={() => state.showView(state.selectedPost as PostListPost)}
					onSubmit={submitPost}
				/>
			) : null}

			{state.screen === "view" && state.selectedPost ? (
				<PostDetail
					post={state.selectedPost}
					onBack={state.showList}
					onDelete={() => state.setDeleteTarget(state.selectedPost)}
					onEdit={() => state.showEdit(state.selectedPost as PostListPost)}
				/>
			) : null}

			{state.screen === "list" ? (
				isLoading ? (
					<PostListLoading />
				) : posts.length === 0 ? (
					<PostEmptyState onCreate={state.showCreate} />
				) : (
					<PostTable
						posts={posts}
						onDelete={state.setDeleteTarget}
						onEdit={state.showEdit}
						onView={state.showView}
					/>
				)
			) : null}

			{state.deleteTarget ? (
				<DeletePostDialog
					isPending={isPending}
					post={state.deleteTarget}
					onCancel={() => state.setDeleteTarget(null)}
					onConfirm={confirmDelete}
				/>
			) : null}
		</div>
	);
}
