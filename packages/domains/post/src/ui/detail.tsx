import { Button } from "@app/ui/components/button";
import type { PostListPost } from "./types.ts";

export function PostDetail({
	post,
	onBack,
	onEdit,
	onDelete,
}: {
	post: PostListPost;
	onBack: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="min-h-[520px] px-7 py-9" data-testid="post-detail">
			<button
				type="button"
				className="mb-8 font-medium text-[#0b63ce] text-sm"
				data-testid="post-detail-back-button"
				onClick={onBack}
			>
				{"<-"} Back to Posts
			</button>
			<article>
				<h2 className="text-3xl font-semibold tracking-normal">{post.title}</h2>
				<div className="my-7 h-px bg-[#dfe3ea]" />
				<div className="max-w-3xl whitespace-pre-wrap text-[#3d4451] text-base leading-7">
					{post.content}
				</div>
			</article>
			<div className="mt-10 flex gap-4">
				<Button
					type="button"
					variant="outline"
					size="lg"
					className="min-w-20"
					data-testid="post-detail-edit-button"
					onClick={onEdit}
				>
					Edit
				</Button>
				<Button
					type="button"
					variant="destructive-ghost"
					size="lg"
					className="min-w-24"
					data-testid="post-detail-delete-button"
					onClick={onDelete}
				>
					Delete
				</Button>
			</div>
		</div>
	);
}
