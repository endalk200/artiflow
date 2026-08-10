import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { getServerSession } from "@/server/auth/session";

export function ArtiflowMark({ className }: { readonly className?: string }) {
	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M12 2.5 21 8v2.4l-9 5.4-9-5.4V8l9-5.5Z"
				fill="currentColor"
				opacity="0.9"
			/>
			<path
				d="m3 13.6 9 5.4 9-5.4v2.4L12 21.5 3 16V13.6Z"
				fill="currentColor"
				opacity="0.45"
			/>
		</svg>
	);
}

export async function SiteHeader() {
	const session = await getServerSession();

	return (
		<header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
			<div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 lg:px-10">
				<div className="flex items-center gap-8">
					<Link
						className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight transition-opacity hover:opacity-80"
						href="/"
					>
						<ArtiflowMark className="size-5" />
						Artiflow
					</Link>
					<nav className="flex items-center gap-1 text-sm">
						<Link
							className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							href="/projects"
						>
							Projects
						</Link>
						<Link
							className="hidden rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:block"
							href="/#getting-started"
						>
							Getting started
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-2">
					{session ? (
						<>
							<span className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline">
								{session.user.name}
							</span>
							<SignOutButton />
						</>
					) : (
						<Link
							className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
							href="/sign-in"
						>
							Sign in
						</Link>
					)}
					<a
						aria-label="Artiflow on GitHub"
						className="hidden items-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
						href="https://github.com/endalk200/artiflow"
						rel="noreferrer"
						target="_blank"
					>
						<span className="sr-only">Artiflow on GitHub</span>
						<svg
							aria-hidden="true"
							className="size-4"
							fill="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.27 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
						</svg>
					</a>
				</div>
			</div>
		</header>
	);
}
