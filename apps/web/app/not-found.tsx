import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
	return (
		<main className="flex min-h-[70vh] items-center px-6 py-16">
			<section className="mx-auto w-full max-w-xl text-center">
				<p
					aria-hidden="true"
					className="font-mono text-8xl font-semibold tracking-[-0.08em] text-muted-foreground/25"
				>
					404
				</p>
				<p className="mt-6 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
					Page not found
				</p>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
					This Artiflow page isn’t available
				</h1>
				<p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">
					It may have been deleted, or the URL may be incorrect. Return home to
					continue exploring Artiflow.
				</p>
				<Link
					className="mt-8 inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
					href="/"
				>
					<ArrowLeft aria-hidden className="size-4" />
					Return home
				</Link>
			</section>
		</main>
	);
}
