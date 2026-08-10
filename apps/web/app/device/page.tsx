import type { Metadata } from "next";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@app/ui/components/card";

import { DeviceAuthorizationForm } from "@/components/auth/device-authorization-form";
import { getServerSession } from "@/server/auth/session";

export const metadata: Metadata = {
	title: "Authorize device",
};

export default async function DeviceAuthorizationPage({
	searchParams,
}: {
	readonly searchParams: Promise<{
		readonly user_code?: string | string[];
	}>;
}) {
	const [session, { user_code: rawUserCode }] = await Promise.all([
		getServerSession(),
		searchParams,
	]);
	const userCode = typeof rawUserCode === "string" ? rawUserCode : "";

	return (
		<main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-20 sm:py-28">
			<Card>
				<CardHeader className="text-center">
					<p className="text-sm font-medium text-primary">Artiflow CLI</p>
					<CardTitle className="text-2xl">Authorize a device</CardTitle>
					<CardDescription>
						Enter the code displayed by the CLI. Artiflow will ask you to sign
						in before approving access.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DeviceAuthorizationForm
						isAuthenticated={Boolean(session)}
						userCode={userCode}
						userLabel={session?.user.email}
					/>
				</CardContent>
			</Card>
		</main>
	);
}
