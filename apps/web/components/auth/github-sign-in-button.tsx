"use client";

import { Button } from "@app/ui/components/button";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function GitHubSignInButton({
	callbackURL,
}: {
	readonly callbackURL: string;
}) {
	const [error, setError] = useState<string>();
	const [isPending, setIsPending] = useState(false);

	async function signIn() {
		setError(undefined);
		setIsPending(true);

		const result = await authClient.signIn.social({
			callbackURL,
			provider: "github",
		});

		if (result.error) {
			setError("GitHub sign-in could not be started. Please try again.");
			setIsPending(false);
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<Button
				className="w-full"
				disabled={isPending}
				onClick={signIn}
				size="lg"
			>
				{isPending ? (
					<LoaderCircle data-icon="inline-start" className="animate-spin" />
				) : (
					<svg
						aria-hidden="true"
						data-icon="inline-start"
						fill="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
					</svg>
				)}
				Continue with GitHub
			</Button>
			{error ? (
				<p aria-live="polite" className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
