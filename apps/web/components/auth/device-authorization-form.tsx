"use client";

import { Button } from "@app/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@app/ui/components/field";
import { Input } from "@app/ui/components/input";
import { Check, LoaderCircle, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Phase = "enter" | "review" | "approved" | "denied";

function normalizeUserCode(value: string): string {
	return value.trim().replaceAll(/[-\s]/g, "").toUpperCase();
}

function responseMessage(error: {
	readonly error_description?: string;
	readonly message?: string;
}) {
	return (
		error.message ??
		error.error_description ??
		"The code is invalid or has expired. Please try again."
	);
}

export function DeviceAuthorizationForm({
	isAuthenticated,
	userCode: initialUserCode,
	userLabel,
}: {
	readonly isAuthenticated: boolean;
	readonly userCode: string;
	readonly userLabel?: string;
}) {
	const [error, setError] = useState<string>();
	const [isPending, setIsPending] = useState(false);
	const [phase, setPhase] = useState<Phase>("enter");
	const [userCode, setUserCode] = useState(initialUserCode);

	async function verify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);

		const normalizedCode = normalizeUserCode(userCode);
		if (!/^[A-Z2-9]{8}$/.test(normalizedCode)) {
			setError("Enter the eight-character code shown by the CLI.");
			return;
		}
		setUserCode(normalizedCode);

		if (!isAuthenticated) {
			const callbackURL = `/device?user_code=${encodeURIComponent(normalizedCode)}`;
			window.location.assign(
				`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`,
			);
			return;
		}

		setIsPending(true);
		const response = await authClient.device({
			query: { user_code: normalizedCode },
		});
		setIsPending(false);

		if (response.error) {
			setError(responseMessage(response.error));
			return;
		}
		setPhase("review");
	}

	async function decide(decision: "approve" | "deny") {
		setError(undefined);
		setIsPending(true);
		const response = await authClient.device[decision]({ userCode });
		setIsPending(false);

		if (response.error) {
			setError(responseMessage(response.error));
			return;
		}
		setPhase(decision === "approve" ? "approved" : "denied");
	}

	if (phase === "approved" || phase === "denied") {
		return (
			<div className="flex flex-col items-center gap-4 text-center">
				{phase === "approved" ? (
					<Check aria-hidden="true" className="size-8 text-primary" />
				) : (
					<X aria-hidden="true" className="size-8 text-muted-foreground" />
				)}
				<h2 className="text-xl font-semibold">
					{phase === "approved" ? "Device authorized" : "Access denied"}
				</h2>
				<p className="text-sm leading-6 text-muted-foreground">
					{phase === "approved"
						? "Return to the CLI to continue. You can close this page."
						: "The CLI was not granted access. You can close this page."}
				</p>
			</div>
		);
	}

	if (phase === "review") {
		return (
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2 text-center">
					<h2 className="text-xl font-semibold">Authorize this CLI?</h2>
					<p className="text-sm leading-6 text-muted-foreground">
						Only approve if the code below matches the code in your terminal.
					</p>
				</div>
				<div className="rounded-lg bg-muted p-4 text-center">
					<p className="font-mono text-xl font-semibold tracking-[0.2em]">
						{userCode}
					</p>
					{userLabel ? (
						<p className="mt-2 text-xs text-muted-foreground">
							Signed in as {userLabel}
						</p>
					) : null}
				</div>
				{error ? (
					<p
						aria-live="polite"
						className="text-sm text-destructive"
						role="alert"
					>
						{error}
					</p>
				) : null}
				<div className="flex gap-3">
					<Button
						className="flex-1"
						disabled={isPending}
						onClick={() => decide("deny")}
						variant="outline"
					>
						<X data-icon="inline-start" />
						Deny
					</Button>
					<Button
						className="flex-1"
						disabled={isPending}
						onClick={() => decide("approve")}
					>
						{isPending ? (
							<LoaderCircle data-icon="inline-start" className="animate-spin" />
						) : (
							<Check data-icon="inline-start" />
						)}
						Approve
					</Button>
				</div>
			</div>
		);
	}

	return (
		<form onSubmit={verify}>
			<FieldGroup>
				<Field data-invalid={Boolean(error)}>
					<FieldLabel htmlFor="user-code">Device code</FieldLabel>
					<Input
						aria-invalid={Boolean(error)}
						autoCapitalize="characters"
						autoComplete="one-time-code"
						className="h-11 text-center font-mono text-lg tracking-[0.2em] uppercase"
						disabled={isPending}
						id="user-code"
						maxLength={12}
						onChange={(event) => setUserCode(event.target.value)}
						placeholder="ABCD-EFGH"
						required
						value={userCode}
					/>
					<FieldError aria-live="polite">{error}</FieldError>
				</Field>
				<Button disabled={isPending} size="lg" type="submit">
					{isPending ? (
						<LoaderCircle data-icon="inline-start" className="animate-spin" />
					) : null}
					Continue
				</Button>
			</FieldGroup>
		</form>
	);
}
