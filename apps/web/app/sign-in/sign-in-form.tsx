"use client";

import { SignInForm } from "@app/auth/client";
import { useRouter } from "next/navigation";

export function SignInPageForm({
	callbackURL,
}: {
	readonly callbackURL: string;
}) {
	const router = useRouter();

	return (
		<SignInForm
			callbackURL={callbackURL}
			onSuccess={() => {
				router.push(callbackURL);
				router.refresh();
			}}
		/>
	);
}
