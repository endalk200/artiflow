import { Button } from "@app/ui/components/button";
import type { PostListPost } from "./types.ts";

export function DeletePostDialog({
	post,
	isPending,
	onCancel,
	onConfirm,
}: {
	post: PostListPost;
	isPending: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4">
			<div
				className="w-full max-w-md rounded-lg border border-[#dfe3ea] bg-white p-10 text-center shadow-xl"
				data-testid="delete-post-dialog"
			>
				<div className="mx-auto mb-7 grid size-20 place-items-center rounded-full bg-[#ffe1e3] text-[#ef3340]">
					<div className="relative h-9 w-7 rounded-sm border-3 border-current">
						<div className="absolute -top-2 left-1 h-1 w-5 rounded bg-current" />
						<div className="absolute top-1 left-1 h-5 w-0.5 bg-current" />
						<div className="absolute top-1 right-1 h-5 w-0.5 bg-current" />
					</div>
				</div>
				<h2 className="text-2xl font-semibold tracking-normal">Delete Post</h2>
				<p className="mt-4 text-[#697180] text-sm">
					Are you sure you want to delete this post?
					<br />
					This action cannot be undone.
				</p>
				<p className="sr-only">{post.title}</p>
				<div className="mt-9 grid grid-cols-2 gap-4">
					<Button
						type="button"
						variant="outline"
						size="lg"
						data-testid="delete-post-cancel-button"
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="lg"
						disabled={isPending}
						data-testid="delete-post-confirm-button"
						onClick={onConfirm}
					>
						Delete
					</Button>
				</div>
			</div>
		</div>
	);
}
