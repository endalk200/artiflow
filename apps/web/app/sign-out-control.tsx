"use client";

import { SignOutButton } from "@app/auth/client";
import { useRouter } from "next/navigation";

export function SignOutControl() {
	const router = useRouter();

	return (
		<SignOutButton
			onSignedOut={() => {
				router.push("/sign-in");
				router.refresh();
			}}
		/>
	);
}
