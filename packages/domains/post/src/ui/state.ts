import { useMemo, useState } from "react";
import {
	initialPostFormValue,
	type PostListPost,
	type PostListScreen,
} from "./types.ts";

export function usePostListState(posts: ReadonlyArray<PostListPost>) {
	const [screen, setScreen] = useState<PostListScreen>("list");
	const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<PostListPost | null>(null);

	const selectedPost = useMemo(
		() =>
			posts.find((post) => post.id === selectedPostId) ?? posts.at(0) ?? null,
		[posts, selectedPostId],
	);

	function showList() {
		setScreen("list");
		setSelectedPostId(null);
	}

	function showCreate() {
		setScreen("create");
		setSelectedPostId(null);
	}

	function showEdit(post: PostListPost) {
		setScreen("edit");
		setSelectedPostId(post.id);
	}

	function showView(post: PostListPost) {
		setScreen("view");
		setSelectedPostId(post.id);
	}

	return {
		deleteTarget,
		initialPostFormValue,
		screen,
		selectedPost,
		selectedPostId,
		setDeleteTarget,
		showCreate,
		showEdit,
		showList,
		showView,
	};
}
