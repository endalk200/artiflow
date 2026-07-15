import { Button } from "@app/ui/components/button";

export function PostListHeader({ onCreate }: { onCreate: () => void }) {
	return (
		<header className="flex h-[76px] items-center justify-between border-[#dfe3ea] border-b px-7">
			<h1 className="text-2xl font-semibold tracking-normal">Posts</h1>
			<Button
				type="button"
				size="lg"
				className="min-w-28"
				data-testid="posts-new-button"
				onClick={onCreate}
			>
				New Post
			</Button>
		</header>
	);
}
