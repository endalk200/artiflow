"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PostClient } from "./client.ts";

const postsQueryKey = ["posts"] as const;

if (typeof window !== "undefined") {
	window.addEventListener("pagehide", () => void PostClient.dispose(), {
		once: true,
	});
}

export function usePosts() {
	return useQuery({
		queryKey: postsQueryKey,
		queryFn: PostClient.list,
	});
}

export function useCreatePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: PostClient.create,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: postsQueryKey }),
	});
}

export function useUpdatePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: PostClient.update,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: postsQueryKey }),
	});
}

export function useDeletePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: PostClient.delete,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: postsQueryKey }),
	});
}
