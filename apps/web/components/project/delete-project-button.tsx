"use client";

import { Button } from "@app/ui/components/button";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
	deleteProjectAction,
	deleteProjectAndLeaveAction,
} from "../../app/projects/actions";

export function DeleteProjectButton({
	label = "Delete",
	projectId,
	projectName,
	redirectAfter = false,
}: {
	readonly label?: string;
	readonly projectId: string;
	readonly projectName: string;
	readonly redirectAfter?: boolean;
}) {
	const [arming, setArming] = useState(false);
	const [pending, startTransition] = useTransition();
	const disarmTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	useEffect(
		() => () => {
			if (disarmTimeout.current !== undefined)
				clearTimeout(disarmTimeout.current);
		},
		[],
	);

	if (pending) {
		return (
			<Button disabled size="sm" variant="ghost">
				<LoaderCircle
					aria-hidden
					className="animate-spin"
					data-icon="inline-start"
				/>
				Deleting…
			</Button>
		);
	}

	if (arming) {
		return (
			<span className="inline-flex shrink-0 items-center gap-1">
				<Button
					onClick={() =>
						startTransition(async () => {
							await (redirectAfter
								? deleteProjectAndLeaveAction(projectId)
								: deleteProjectAction(projectId));
						})
					}
					size="sm"
					type="button"
					variant="destructive"
				>
					Confirm delete
				</Button>
				<Button
					onClick={() => setArming(false)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Cancel
				</Button>
			</span>
		);
	}

	return (
		<Button
			aria-label={`Delete project ${projectName}`}
			onClick={() => {
				setArming(true);
				if (disarmTimeout.current !== undefined)
					clearTimeout(disarmTimeout.current);
				disarmTimeout.current = setTimeout(() => setArming(false), 5000);
			}}
			size="sm"
			type="button"
			variant="destructive-ghost"
		>
			<Trash2 aria-hidden data-icon="inline-start" />
			{label}
		</Button>
	);
}
