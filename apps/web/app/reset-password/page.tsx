import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "../session";
import { ResetPasswordPageForm } from "./reset-password-form";

type ResetPasswordPageProps = {
	readonly searchParams?: Promise<{
		readonly error?: string;
		readonly token?: string;
	}>;
};

export default async function ResetPasswordPage({
	searchParams,
}: ResetPasswordPageProps) {
	const session = await getServerSession();
	const params = await searchParams;
	const token = params?.token ?? "";

	if (session) {
		redirect("/");
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4 py-10 text-[#17181c]">
			<section className="w-full max-w-sm">
				<h1 className="mb-2 text-2xl font-semibold tracking-normal">
					Set password
				</h1>
				<p className="mb-8 text-sm text-muted-foreground">
					Choose a new password for your account.
				</p>
				{params?.error ? (
					<p className="mb-5 text-sm text-destructive" role="alert">
						Reset link is invalid or expired.
					</p>
				) : null}
				<ResetPasswordPageForm token={token} />
				<p className="mt-6 text-sm text-muted-foreground">
					<Link href="/sign-in" className="text-primary underline">
						Back to sign in
					</Link>
				</p>
			</section>
		</main>
	);
}
