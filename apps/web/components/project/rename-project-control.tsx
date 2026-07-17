"use client";

import { Check, LoaderCircle, PencilLine, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import {
	renameProjectAction,
	type ProjectActionState,
} from "../../app/projects/actions";

const initialState: ProjectActionState = {};

export function RenameProjectControl({
	projectId,
	projectName,
}: {
	readonly projectId: string;
	readonly projectName: string;
}) {
	const [editing, setEditing] = useState(false);
	const [state, formAction, pending] = useActionState(
		renameProjectAction.bind(null, projectId),
		initialState,
	);

	useEffect(() => {
		if (!pending && state.error === undefined) setEditing(false);
	}, [pending, state]);

	if (!editing) {
		return (
			<button
				className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				onClick={() => setEditing(true)}
				type="button"
			>
				<PencilLine aria-hidden className="size-3.5" />
				Rename
			</button>
		);
	}

	return (
		<form action={formAction} className="flex flex-col gap-1.5">
			<div className="flex items-center gap-1.5">
				<input
					aria-label="New project name"
					autoComplete="off"
					// biome-ignore lint/a11y/noAutofocus: focus moves into the field the user just opened
					autoFocus
					className="h-8 w-56 rounded-lg border bg-background px-3 text-sm shadow-xs outline-none transition focus-visible:ring-2 focus-visible:ring-ring/40"
					defaultValue={projectName}
					disabled={pending}
					maxLength={120}
					name="name"
					required
				/>
				<button
					aria-label="Save name"
					className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
					disabled={pending}
					type="submit"
				>
					{pending ? (
						<LoaderCircle aria-hidden className="size-3.5 animate-spin" />
					) : (
						<Check aria-hidden className="size-3.5" />
					)}
				</button>
				<button
					aria-label="Cancel rename"
					className="inline-flex size-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onClick={() => setEditing(false)}
					type="button"
				>
					<X aria-hidden className="size-3.5" />
				</button>
			</div>
			{state.error !== undefined ? (
				<p className="text-xs text-destructive" role="alert">
					{state.error}
				</p>
			) : null}
		</form>
	);
}
