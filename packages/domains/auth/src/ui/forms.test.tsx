import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	ForgotPasswordForm,
	ResetPasswordForm,
	SignInForm,
	SignOutButton,
	SignUpForm,
} from "./forms.tsx";

describe("auth forms", () => {
	it("validates sign-in email on blur", async () => {
		render(<SignInForm signIn={vi.fn()} />);

		fireEvent.change(screen.getByTestId("sign-in-email-input"), {
			target: { value: "not-an-email" },
		});
		fireEvent.blur(screen.getByTestId("sign-in-email-input"));

		expect(await screen.findByText("Enter a valid email.")).toBeVisible();
	});

	it("submits sign-in values and calls onSuccess", async () => {
		const signIn = vi.fn().mockResolvedValue({ error: null });
		const onSuccess = vi.fn();

		render(
			<SignInForm callbackURL="/" signIn={signIn} onSuccess={onSuccess} />,
		);

		fireEvent.change(screen.getByTestId("sign-in-email-input"), {
			target: { value: "  user@example.com  " },
		});
		fireEvent.change(screen.getByTestId("sign-in-password-input"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

		await waitFor(() => {
			expect(signIn).toHaveBeenCalledWith({
				email: "user@example.com",
				password: "password123",
				callbackURL: "/",
			});
			expect(onSuccess).toHaveBeenCalledTimes(1);
		});
	});

	it("shows auth errors returned by sign-in", async () => {
		const signIn = vi
			.fn()
			.mockResolvedValue({ error: { message: "Invalid credentials." } });

		render(<SignInForm signIn={signIn} />);

		fireEvent.change(screen.getByTestId("sign-in-email-input"), {
			target: { value: "user@example.com" },
		});
		fireEvent.change(screen.getByTestId("sign-in-password-input"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText("Invalid credentials.")).toBeVisible();
	});

	it("validates sign-up password length", async () => {
		render(<SignUpForm signUp={vi.fn()} />);

		fireEvent.change(screen.getByTestId("sign-up-password-input"), {
			target: { value: "short" },
		});
		fireEvent.blur(screen.getByTestId("sign-up-password-input"));

		expect(
			await screen.findByText("Password must be at least 8 characters."),
		).toBeVisible();
	});

	it("submits sign-up values and shows the verification message", async () => {
		const signUp = vi.fn().mockResolvedValue({ error: null });

		render(<SignUpForm callbackURL="/" signUp={signUp} />);

		fireEvent.change(screen.getByTestId("sign-up-name-input"), {
			target: { value: "  User One  " },
		});
		fireEvent.change(screen.getByTestId("sign-up-email-input"), {
			target: { value: "user@example.com" },
		});
		fireEvent.change(screen.getByTestId("sign-up-password-input"), {
			target: { value: "password123" },
		});
		fireEvent.change(screen.getByTestId("sign-up-confirm-password-input"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create account" }));

		await waitFor(() => {
			expect(signUp).toHaveBeenCalledWith({
				name: "User One",
				email: "user@example.com",
				password: "password123",
				callbackURL: "/",
			});
		});
		expect(
			await screen.findByText("Check your email to verify your account."),
		).toBeVisible();
	});

	it("requests a password reset with the configured redirect", async () => {
		const requestPasswordReset = vi.fn().mockResolvedValue({ error: null });

		render(
			<ForgotPasswordForm
				redirectTo="/reset-password"
				requestPasswordReset={requestPasswordReset}
			/>,
		);

		fireEvent.change(screen.getByTestId("forgot-password-email-input"), {
			target: { value: "user@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

		await waitFor(() => {
			expect(requestPasswordReset).toHaveBeenCalledWith({
				email: "user@example.com",
				redirectTo: "/reset-password",
			});
		});
		expect(
			await screen.findByText(
				"If that account exists, a reset link is on its way.",
			),
		).toBeVisible();
	});

	it("does not reset a password without a token", async () => {
		const resetPassword = vi.fn().mockResolvedValue({ error: null });

		render(<ResetPasswordForm token="" resetPassword={resetPassword} />);

		fireEvent.change(screen.getByTestId("reset-password-input"), {
			target: { value: "password123" },
		});
		fireEvent.change(screen.getByTestId("reset-confirm-password-input"), {
			target: { value: "password123" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Update password" }));

		expect(
			await screen.findByText("Reset token is missing or invalid."),
		).toBeVisible();
		expect(resetPassword).not.toHaveBeenCalled();
	});

	it("signs out and calls onSignedOut", async () => {
		const signOut = vi.fn().mockResolvedValue({ error: null });
		const onSignedOut = vi.fn();

		render(<SignOutButton signOut={signOut} onSignedOut={onSignedOut} />);

		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOut).toHaveBeenCalledTimes(1);
			expect(onSignedOut).toHaveBeenCalledTimes(1);
		});
	});

	it("does not call onSignedOut when sign-out returns an error", async () => {
		const signOut = vi
			.fn()
			.mockResolvedValue({ error: { message: "Sign out failed." } });
		const onSignedOut = vi.fn();

		render(<SignOutButton signOut={signOut} onSignedOut={onSignedOut} />);

		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOut).toHaveBeenCalledTimes(1);
			expect(onSignedOut).not.toHaveBeenCalled();
			expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
		});
	});

	it("clears pending and does not call onSignedOut when sign-out rejects", async () => {
		const signOut = vi.fn().mockRejectedValue(new Error("Network failed."));
		const onSignedOut = vi.fn();

		render(<SignOutButton signOut={signOut} onSignedOut={onSignedOut} />);

		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOut).toHaveBeenCalledTimes(1);
			expect(onSignedOut).not.toHaveBeenCalled();
			expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
		});
	});
});
