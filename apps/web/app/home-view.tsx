import { PostListController } from "@app/post/client";
import { SignOutControl } from "./sign-out-control";

export function HomeView({ email }: { email: string }) {
	return (
		<main className="min-h-screen bg-[#f7f7f8] px-4 py-10 text-[#17181c] sm:px-6">
			<section className="mx-auto w-full max-w-5xl">
				<header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-normal">Posts</h1>
						<p className="text-sm text-muted-foreground">{email}</p>
					</div>
					<SignOutControl />
				</header>
				<PostListController />
			</section>
		</main>
	);
}
