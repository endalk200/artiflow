"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import {
	createProjectAction,
	type ProjectActionState,
} from "../../app/projects/actions";

const initialState: ProjectActionState = {};

export function CreateProjectForm() {
	const [state, formAction, pending] = useActionState(
		createProjectAction,
		initialState,
	);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (!pending && state.error === undefined) formRef.current?.reset();
	}, [pending, state]);

	return (
		<form action={formAction} className="w-full sm:w-auto" ref={formRef}>
			<div className="flex w-full items-center gap-2">
				<input
					aria-label="Project name"
					autoComplete="off"
					className="h-9 w-full rounded-lg border bg-background px-3.5 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-64"
					disabled={pending}
					maxLength={120}
					name="name"
					placeholder="New project name…"
					required
				/>
				<button
					className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
					disabled={pending}
					type="submit"
				>
					{pending ? (
						<LoaderCircle aria-hidden className="size-4 animate-spin" />
					) : (
						<Plus aria-hidden className="size-4" />
					)}
					Create
				</button>
			</div>
			{state.error !== undefined ? (
				<p className="mt-2 text-sm text-destructive" role="alert">
					{state.error}
				</p>
			) : null}
		</form>
	);
}
