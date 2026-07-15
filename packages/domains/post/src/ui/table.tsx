import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@app/ui/components/table";
import { PostListItem } from "./item.tsx";
import type { PostListPost } from "./types.ts";

export function PostTable({
	posts,
	onView,
	onEdit,
	onDelete,
}: {
	posts: ReadonlyArray<PostListPost>;
	onView: (post: PostListPost) => void;
	onEdit: (post: PostListPost) => void;
	onDelete: (post: PostListPost) => void;
}) {
	return (
		<div className="min-h-[520px] px-7 py-8">
			<Table className="table-fixed" data-testid="posts-table">
				<TableHeader>
					<TableRow>
						<TableHead>Title</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{posts.map((post) => (
						<PostListItem
							key={post.id}
							post={post}
							onDelete={() => onDelete(post)}
							onEdit={() => onEdit(post)}
							onView={() => onView(post)}
						/>
					))}
				</TableBody>
			</Table>
			<p className="mt-7 text-[#697180] text-sm">
				Showing 1 to {posts.length} of {posts.length}{" "}
				{posts.length === 1 ? "post" : "posts"}
			</p>
		</div>
	);
}
