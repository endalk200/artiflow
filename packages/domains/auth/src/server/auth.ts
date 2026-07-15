import { createPrismaClient } from "@app/database";
import { appConfig } from "@app/config/env";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";

import { makeAuthMiddlewareLayer } from "./auth-middleware.ts";
import { sendAuthEmail } from "./email.tsx";

function trustedOrigins() {
	const origins = [appConfig.BETTER_AUTH_URL, appConfig.NEXT_PUBLIC_APP_URL];

	if (appConfig.NODE_ENV !== "production") {
		origins.push("http://127.0.0.1:3000", "http://localhost:3000");
	}

	return origins.filter(
		(value, index, values): value is string => values.indexOf(value) === index,
	);
}

declare global {
	var __launchkeyAuthPrisma: ReturnType<typeof createPrismaClient> | undefined;
}

function getAuthPrismaClient() {
	globalThis.__launchkeyAuthPrisma ??= createPrismaClient(
		appConfig.DATABASE_URL,
	);

	return globalThis.__launchkeyAuthPrisma;
}

const prisma = getAuthPrismaClient();

export const authOptions = {
	database: prismaAdapter(prisma, {
		provider: "postgresql",
		transaction: true,
	}),
	secret: appConfig.BETTER_AUTH_SECRET,
	baseURL: appConfig.BETTER_AUTH_URL,
	trustedOrigins: trustedOrigins(),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		revokeSessionsOnPasswordReset: true,
		resetPasswordTokenExpiresIn: 60 * 60,
		sendResetPassword: async ({
			user,
			url,
		}: {
			user: { email: string; name?: string | null };
			url: string;
		}) => {
			await sendAuthEmail({
				kind: "password-reset",
				to: user.email,
				name: user.name,
				url,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		expiresIn: 60 * 60 * 24,
		sendVerificationEmail: async ({
			user,
			url,
		}: {
			user: { email: string; name?: string | null };
			url: string;
		}) => {
			await sendAuthEmail({
				kind: "email-verification",
				to: user.email,
				name: user.name,
				url,
			});
		},
	},
	plugins: [nextCookies()],
};

export const auth = betterAuth(authOptions);

export const authRouteHandlers = toNextJsHandler(auth);

export const AuthMiddlewareLive = makeAuthMiddlewareLayer((headers) =>
	auth.api.getSession({ headers }),
);
