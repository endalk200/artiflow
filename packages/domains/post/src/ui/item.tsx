import { Button } from "@app/ui/components/button";
import { TableCell, TableRow } from "@app/ui/components/table";
import type { PostListPost } from "./types.ts";

export function PostListItem({
	post,
	onView,
	onEdit,
	onDelete,
}: {
	post: PostListPost;
	onView: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<TableRow data-testid="post-row">
			<TableCell className="py-5 pr-4 font-medium">
				<button
					type="button"
					className="text-left"
					data-testid="post-row-title-button"
					onClick={onView}
				>
					{post.title}
				</button>
			</TableCell>
			<TableCell className="w-[220px] py-5 text-right">
				<div className="inline-flex items-center gap-7 text-sm">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						data-testid="post-row-view-button"
						onClick={onView}
					>
						View
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						data-testid="post-row-edit-button"
						onClick={onEdit}
					>
						Edit
					</Button>
					<Button
						type="button"
						variant="destructive-ghost"
						size="sm"
						data-testid="post-row-delete-button"
						onClick={onDelete}
					>
						Delete
					</Button>
				</div>
			</TableCell>
		</TableRow>
	);
}
