"use client";

import { Button } from "@app/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@app/ui/components/field";
import { Input } from "@app/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { z } from "zod";

import { authClient } from "../client/client.ts";

type AuthError = {
	readonly message?: string;
	readonly statusText?: string;
} | null;

type AuthActionResult = {
	readonly error?: AuthError;
};

type SignInInput = {
	readonly email: string;
	readonly password: string;
	readonly callbackURL?: string;
};

type SignUpInput = {
	readonly name: string;
	readonly email: string;
	readonly password: string;
	readonly callbackURL?: string;
};

type ForgotPasswordInput = {
	readonly email: string;
	readonly redirectTo: string;
};

type ResetPasswordInput = {
	readonly token: string;
	readonly newPassword: string;
};

type BetterAuthClient = typeof authClient & {
	readonly signIn: {
		readonly email: (input: SignInInput) => Promise<AuthActionResult>;
	};
	readonly signUp: {
		readonly email: (input: SignUpInput) => Promise<AuthActionResult>;
	};
	readonly requestPasswordReset: (
		input: ForgotPasswordInput,
	) => Promise<AuthActionResult>;
	readonly resetPassword: (
		input: ResetPasswordInput,
	) => Promise<AuthActionResult>;
	readonly signOut: () => Promise<AuthActionResult>;
};

const client = authClient as BetterAuthClient;

const emailSchema = z
	.string()
	.trim()
	.min(1, "Email is required.")
	.email("Enter a valid email.");
const nameSchema = z.string().trim().min(1, "Name is required.");
const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters.");

const signInSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "Password is required."),
});

const signUpSchema = z
	.object({
		name: nameSchema,
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: z.string().min(1, "Confirm your password."),
	})
	.refine((value) => value.password === value.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords must match.",
	});

const forgotPasswordSchema = z.object({
	email: emailSchema,
});

const resetPasswordSchema = z
	.object({
		password: passwordSchema,
		confirmPassword: z.string().min(1, "Confirm your password."),
	})
	.refine((value) => value.password === value.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords must match.",
	});

function fieldErrors(errors: ReadonlyArray<unknown>) {
	return errors.map((error) => {
		if (typeof error === "string") {
			return { message: error };
		}

		if (
			typeof error === "object" &&
			error !== null &&
			"message" in error &&
			typeof error.message === "string"
		) {
			return { message: error.message };
		}

		return { message: "Invalid value." };
	});
}

function messageFromError(error: AuthError) {
	return (
		error?.message ??
		error?.statusText ??
		"Something went wrong. Please try again."
	);
}

function StatusMessage({
	message,
	tone,
}: {
	message: string | null;
	tone: "error" | "success";
}) {
	if (!message) {
		return null;
	}

	return (
		<p
			className={
				tone === "error"
					? "text-sm text-destructive"
					: "text-sm text-muted-foreground"
			}
			role={tone === "error" ? "alert" : "status"}
		>
			{message}
		</p>
	);
}

function SubmitButton({
	children,
	isPending,
}: {
	children: string;
	isPending: boolean;
}) {
	return (
		<Button type="submit" disabled={isPending}>
			{isPending ? "Submitting" : children}
		</Button>
	);
}

export function SignInForm({
	callbackURL = "/",
	onSuccess,
	signIn = (input) => client.signIn.email(input),
}: {
	readonly callbackURL?: string;
	readonly onSuccess?: () => void;
	readonly signIn?: (input: SignInInput) => Promise<AuthActionResult>;
}) {
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: signInSchema,
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setStatus(null);
			setIsPending(true);

			try {
				const result = await signIn({
					email: value.email.trim(),
					password: value.password,
					callbackURL,
				});

				if (result.error) {
					setError(messageFromError(result.error));
					return;
				}

				setStatus("Signed in.");
				onSuccess?.();
			} finally {
				setIsPending(false);
			}
		},
	});

	return (
		<form
			className="flex w-full max-w-sm flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="email" validators={{ onBlur: emailSchema }}>
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Email</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									autoComplete="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="sign-in-email-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="password">
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Password</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									autoComplete="current-password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="sign-in-password-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			<StatusMessage message={error} tone="error" />
			<StatusMessage message={status} tone="success" />
			<SubmitButton isPending={isPending}>Sign in</SubmitButton>
		</form>
	);
}

export function SignUpForm({
	callbackURL = "/",
	onSuccess,
	signUp = (input) => client.signUp.email(input),
}: {
	readonly callbackURL?: string;
	readonly onSuccess?: () => void;
	readonly signUp?: (input: SignUpInput) => Promise<AuthActionResult>;
}) {
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: signUpSchema,
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setStatus(null);
			setIsPending(true);

			try {
				const result = await signUp({
					name: value.name.trim(),
					email: value.email.trim(),
					password: value.password,
					callbackURL,
				});

				if (result.error) {
					setError(messageFromError(result.error));
					return;
				}

				setStatus("Check your email to verify your account.");
				onSuccess?.();
			} finally {
				setIsPending(false);
			}
		},
	});

	return (
		<form
			className="flex w-full max-w-sm flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="name" validators={{ onBlur: nameSchema }}>
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Name</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="text"
									autoComplete="name"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="sign-up-name-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="email" validators={{ onBlur: emailSchema }}>
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Email</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									autoComplete="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="sign-up-email-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="password" validators={{ onBlur: passwordSchema }}>
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Password</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									autoComplete="new-password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="sign-up-password-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									autoComplete="new-password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="sign-up-confirm-password-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			<StatusMessage message={error} tone="error" />
			<StatusMessage message={status} tone="success" />
			<SubmitButton isPending={isPending}>Create account</SubmitButton>
		</form>
	);
}

export function ForgotPasswordForm({
	redirectTo,
	onSuccess,
	requestPasswordReset = (input) => client.requestPasswordReset(input),
}: {
	readonly redirectTo: string;
	readonly onSuccess?: () => void;
	readonly requestPasswordReset?: (
		input: ForgotPasswordInput,
	) => Promise<AuthActionResult>;
}) {
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const form = useForm({
		defaultValues: {
			email: "",
		},
		validators: {
			onSubmit: forgotPasswordSchema,
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setStatus(null);
			setIsPending(true);

			try {
				const result = await requestPasswordReset({
					email: value.email.trim(),
					redirectTo,
				});

				if (result.error) {
					setError(messageFromError(result.error));
					return;
				}

				setStatus("If that account exists, a reset link is on its way.");
				onSuccess?.();
			} finally {
				setIsPending(false);
			}
		},
	});

	return (
		<form
			className="flex w-full max-w-sm flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="email" validators={{ onBlur: emailSchema }}>
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Email</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="email"
									autoComplete="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="forgot-password-email-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			<StatusMessage message={error} tone="error" />
			<StatusMessage message={status} tone="success" />
			<SubmitButton isPending={isPending}>Send reset link</SubmitButton>
		</form>
	);
}

export function ResetPasswordForm({
	token,
	onSuccess,
	resetPassword = (input) => client.resetPassword(input),
}: {
	readonly token: string;
	readonly onSuccess?: () => void;
	readonly resetPassword?: (
		input: ResetPasswordInput,
	) => Promise<AuthActionResult>;
}) {
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const form = useForm({
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: resetPasswordSchema,
		},
		onSubmit: async ({ value }) => {
			setError(null);
			setStatus(null);
			setIsPending(true);

			try {
				if (!token) {
					setError("Reset token is missing or invalid.");
					return;
				}

				const result = await resetPassword({
					token,
					newPassword: value.password,
				});

				if (result.error) {
					setError(messageFromError(result.error));
					return;
				}

				setStatus("Password updated. You can sign in with the new password.");
				onSuccess?.();
			} finally {
				setIsPending(false);
			}
		},
	});

	return (
		<form
			className="flex w-full max-w-sm flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="password" validators={{ onBlur: passwordSchema }}>
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>New password</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									autoComplete="new-password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="reset-password-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => {
						const errors = field.state.meta.isTouched
							? fieldErrors(field.state.meta.errors)
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									autoComplete="new-password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									aria-invalid={isInvalid}
									data-testid="reset-confirm-password-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			<StatusMessage message={error} tone="error" />
			<StatusMessage message={status} tone="success" />
			<SubmitButton isPending={isPending}>Update password</SubmitButton>
		</form>
	);
}

export function SignOutButton({
	onSignedOut,
	signOut = () => client.signOut(),
}: {
	readonly onSignedOut?: () => void;
	readonly signOut?: () => Promise<AuthActionResult>;
}) {
	const [isPending, setIsPending] = useState(false);

	return (
		<Button
			type="button"
			variant="outline"
			disabled={isPending}
			onClick={async () => {
				setIsPending(true);

				try {
					const result = await signOut();

					if (result.error) {
						return;
					}

					onSignedOut?.();
				} catch {
					return;
				} finally {
					setIsPending(false);
				}
			}}
		>
			Sign out
		</Button>
	);
}
