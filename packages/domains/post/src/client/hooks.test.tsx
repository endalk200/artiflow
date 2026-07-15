import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostClient } from "./client.ts";
import {
	useCreatePost,
	useDeletePost,
	usePosts,
	useUpdatePost,
} from "./hooks.ts";

vi.mock("./client.ts", () => ({
	PostClient: {
		create: vi.fn(),
		delete: vi.fn(),
		dispose: vi.fn(),
		list: vi.fn(),
		update: vi.fn(),
	},
}));

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function createTestQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
			mutations: {
				retry: false,
			},
		},
	});
}

describe("post client hooks", () => {
	beforeEach(() => {
		vi.mocked(PostClient.create).mockReset();
		vi.mocked(PostClient.delete).mockReset();
		vi.mocked(PostClient.list).mockReset();
		vi.mocked(PostClient.update).mockReset();
	});

	it("loads posts through the post client", async () => {
		vi.mocked(PostClient.list).mockResolvedValue([
			{
				id: "post-1",
				title: "First post",
				content: "First body",
			},
		]);
		const queryClient = createTestQueryClient();

		const { result } = renderHook(() => usePosts(), {
			wrapper: createWrapper(queryClient),
		});

		await waitFor(() => {
			expect(result.current.data).toEqual([
				{
					id: "post-1",
					title: "First post",
					content: "First body",
				},
			]);
		});
		expect(PostClient.list).toHaveBeenCalledTimes(1);
	});

	it("invalidates the posts query after creating a post", async () => {
		vi.mocked(PostClient.create).mockResolvedValue({
			id: "created",
			title: "Created post",
			content: "Created body",
		});
		const queryClient = createTestQueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useCreatePost(), {
			wrapper: createWrapper(queryClient),
		});

		await act(() =>
			result.current.mutateAsync({
				title: "Created post",
				content: "Created body",
			}),
		);

		expect(vi.mocked(PostClient.create).mock.calls[0]?.[0]).toEqual({
			title: "Created post",
			content: "Created body",
		});
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["posts"] });
	});

	it("invalidates the posts query after updating a post", async () => {
		vi.mocked(PostClient.update).mockResolvedValue({
			id: "post-1",
			title: "Updated post",
			content: "Updated body",
		});
		const queryClient = createTestQueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useUpdatePost(), {
			wrapper: createWrapper(queryClient),
		});

		await act(() =>
			result.current.mutateAsync({
				id: "post-1",
				title: "Updated post",
				content: "Updated body",
			}),
		);

		expect(vi.mocked(PostClient.update).mock.calls[0]?.[0]).toEqual({
			id: "post-1",
			title: "Updated post",
			content: "Updated body",
		});
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["posts"] });
	});

	it("invalidates the posts query after deleting a post", async () => {
		vi.mocked(PostClient.delete).mockResolvedValue({
			id: "post-1",
			title: "Deleted post",
			content: "Deleted body",
		});
		const queryClient = createTestQueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		const { result } = renderHook(() => useDeletePost(), {
			wrapper: createWrapper(queryClient),
		});

		await act(() => result.current.mutateAsync("post-1"));

		expect(vi.mocked(PostClient.delete).mock.calls[0]?.[0]).toBe("post-1");
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["posts"] });
	});
});
