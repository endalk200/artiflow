import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@app/ui/components/card";

import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { safeCallbackURL } from "@/lib/auth/callback-url";
import { getServerSession } from "@/server/auth/session";

export const metadata: Metadata = {
	title: "Sign in",
};

export default async function SignInPage({
	searchParams,
}: {
	readonly searchParams: Promise<{
		readonly callbackURL?: string | string[];
	}>;
}) {
	const { callbackURL: rawCallbackURL } = await searchParams;
	const callbackURL = safeCallbackURL(rawCallbackURL);
	const session = await getServerSession();

	if (session) {
		redirect(callbackURL);
	}

	return (
		<main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-20 sm:py-28">
			<Card>
				<CardHeader className="text-center">
					<p className="text-sm font-medium text-primary">Artiflow</p>
					<CardTitle className="text-2xl">Sign in to continue</CardTitle>
					<CardDescription>
						Use your GitHub account to access your projects and the Artiflow
						CLI.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<GitHubSignInButton callbackURL={callbackURL} />
				</CardContent>
			</Card>
		</main>
	);
}
