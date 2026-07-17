"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CopyButton({
	className,
	label = "Copy",
	value,
}: {
	readonly className?: string;
	readonly label?: string;
	readonly value: string;
}) {
	const [copied, setCopied] = useState(false);
	const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(
		() => () => {
			if (timeout.current !== undefined) clearTimeout(timeout.current);
		},
		[],
	);

	return (
		<button
			className={
				className ??
				"inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			}
			onClick={() => {
				void navigator.clipboard.writeText(value).then(() => {
					setCopied(true);
					if (timeout.current !== undefined) clearTimeout(timeout.current);
					timeout.current = setTimeout(() => setCopied(false), 2000);
				});
			}}
			type="button"
		>
			{copied ? (
				<Check aria-hidden className="size-3.5" />
			) : (
				<Copy aria-hidden className="size-3.5" />
			)}
			{copied ? "Copied" : label}
		</button>
	);
}
