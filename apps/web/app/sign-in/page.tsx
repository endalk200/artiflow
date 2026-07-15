import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "../session";
import { callbackFrom } from "./callback-url";
import { SignInPageForm } from "./sign-in-form";

type SignInPageProps = {
	readonly searchParams?: Promise<{
		readonly callbackURL?: string;
	}>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
	const session = await getServerSession();
	const params = await searchParams;
	const callbackURL = callbackFrom(params?.callbackURL);

	if (session) {
		redirect(callbackURL);
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4 py-10 text-[#17181c]">
			<section className="w-full max-w-sm">
				<h1 className="mb-2 text-2xl font-semibold tracking-normal">Sign in</h1>
				<p className="mb-8 text-sm text-muted-foreground">
					Use your account to manage posts.
				</p>
				<SignInPageForm callbackURL={callbackURL} />
				<div className="mt-6 flex items-center justify-between text-sm">
					<Link href="/forgot-password" className="text-primary underline">
						Forgot password?
					</Link>
					<Link href="/sign-up" className="text-primary underline">
						Create account
					</Link>
				</div>
			</section>
		</main>
	);
}
