import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
	ForgotPasswordForm,
	ResetPasswordForm,
	SignInForm,
	SignOutButton,
	SignUpForm,
} from "./forms.tsx";

const meta = {
	title: "Auth/Forms",
	parameters: {
		layout: "centered",
	},
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignIn = {
	render: () => <SignInForm signIn={async () => ({ error: null })} />,
} satisfies Story;

export const SignUp = {
	render: () => <SignUpForm signUp={async () => ({ error: null })} />,
} satisfies Story;

export const ForgotPassword = {
	render: () => (
		<ForgotPasswordForm
			redirectTo="/reset-password"
			requestPasswordReset={async () => ({ error: null })}
		/>
	),
} satisfies Story;

export const ResetPassword = {
	render: () => (
		<ResetPasswordForm
			token="storybook-token"
			resetPassword={async () => ({ error: null })}
		/>
	),
} satisfies Story;

export const SignOut = {
	render: () => <SignOutButton signOut={async () => ({ error: null })} />,
} satisfies Story;
