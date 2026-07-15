"use client";

import { ResetPasswordForm } from "@app/auth/client";
import { useRouter } from "next/navigation";

export function ResetPasswordPageForm({ token }: { readonly token: string }) {
	const router = useRouter();

	return (
		<ResetPasswordForm
			token={token}
			onSuccess={() => {
				router.push("/sign-in");
			}}
		/>
	);
}
