import { ForgotPasswordForm } from "@app/auth/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "../session";

export default async function ForgotPasswordPage() {
	const session = await getServerSession();

	if (session) {
		redirect("/");
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4 py-10 text-[#17181c]">
			<section className="w-full max-w-sm">
				<h1 className="mb-2 text-2xl font-semibold tracking-normal">
					Reset password
				</h1>
				<p className="mb-8 text-sm text-muted-foreground">
					Enter the email on your account.
				</p>
				<ForgotPasswordForm redirectTo="/reset-password" />
				<p className="mt-6 text-sm text-muted-foreground">
					Remembered it?{" "}
					<Link href="/sign-in" className="text-primary underline">
						Sign in
					</Link>
				</p>
			</section>
		</main>
	);
}
