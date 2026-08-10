"use client";

import { Button } from "@app/ui/components/button";
import { LoaderCircle, LogOut } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
	const [isPending, setIsPending] = useState(false);

	async function signOut() {
		setIsPending(true);
		const result = await authClient.signOut();
		if (result.error) {
			setIsPending(false);
			return;
		}
		window.location.assign("/");
	}

	return (
		<Button disabled={isPending} onClick={signOut} size="sm" variant="ghost">
			{isPending ? (
				<LoaderCircle data-icon="inline-start" className="animate-spin" />
			) : (
				<LogOut data-icon="inline-start" />
			)}
			<span className="hidden sm:inline">Sign out</span>
		</Button>
	);
}
