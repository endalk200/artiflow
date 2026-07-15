import { Button } from "@app/ui/components/button";

export function PostEmptyState({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="flex min-h-[520px] flex-col items-center justify-center px-7 py-16 text-center">
			<div className="mb-6 grid size-24 place-items-center rounded-full bg-[#f1f2f4]">
				<div className="relative h-11 w-9 rounded border-3 border-[#7c8491] bg-white">
					<div className="absolute top-2 right-1 left-2 h-0.5 bg-[#7c8491]" />
					<div className="absolute top-5 right-1 left-2 h-0.5 bg-[#7c8491]" />
					<div className="absolute top-[-3px] right-[-3px] size-4 border-[#7c8491] border-t-3 border-r-3 bg-[#f1f2f4]" />
				</div>
			</div>
			<h2 className="text-2xl font-semibold tracking-normal">No posts yet</h2>
			<p className="mt-3 text-[#697180] text-sm">
				Get started by creating your first post.
			</p>
			<Button
				type="button"
				size="lg"
				className="mt-6 min-w-28"
				data-testid="posts-empty-new-button"
				onClick={onCreate}
			>
				New Post
			</Button>
		</div>
	);
}
