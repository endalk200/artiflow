import { type Auth, betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import { Pool } from "pg";

import { authEnvironment } from "./environment";

export const ARTIFLOW_CLI_CLIENT_ID = "artiflow-cli";

const globalWithAuthPool = globalThis as typeof globalThis & {
	artiflowAuthPool?: Pool;
};

const database =
	globalWithAuthPool.artiflowAuthPool ??
	new Pool({ connectionString: authEnvironment.databaseURL });

if (process.env.NODE_ENV !== "production") {
	globalWithAuthPool.artiflowAuthPool = database;
}

const authOptions: BetterAuthOptions = {
	account: {
		fields: {
			accessToken: "access_token",
			accessTokenExpiresAt: "access_token_expires_at",
			accountId: "account_id",
			createdAt: "created_at",
			idToken: "id_token",
			providerId: "provider_id",
			refreshToken: "refresh_token",
			refreshTokenExpiresAt: "refresh_token_expires_at",
			updatedAt: "updated_at",
			userId: "user_id",
		},
		modelName: "account",
	},
	baseURL: authEnvironment.baseURL,
	database,
	emailAndPassword: {
		enabled: false,
	},
	plugins: [
		bearer(),
		deviceAuthorization({
			schema: {
				deviceCode: {
					fields: {
						clientId: "client_id",
						deviceCode: "device_code",
						expiresAt: "expires_at",
						lastPolledAt: "last_polled_at",
						pollingInterval: "polling_interval",
						userCode: "user_code",
						userId: "user_id",
					},
					modelName: "device_code",
				},
			},
			validateClient: (clientId) => clientId === ARTIFLOW_CLI_CLIENT_ID,
			verificationUri: "/device",
		}),
		nextCookies(),
	],
	secret: authEnvironment.secret,
	session: {
		fields: {
			createdAt: "created_at",
			expiresAt: "expires_at",
			ipAddress: "ip_address",
			updatedAt: "updated_at",
			userAgent: "user_agent",
			userId: "user_id",
		},
		modelName: "session",
	},
	socialProviders: {
		github: {
			clientId: authEnvironment.githubClientId,
			clientSecret: authEnvironment.githubClientSecret,
		},
	},
	trustedOrigins: [authEnvironment.baseURL],
	user: {
		fields: {
			createdAt: "created_at",
			emailVerified: "email_verified",
			updatedAt: "updated_at",
		},
		modelName: "user",
	},
	verification: {
		fields: {
			createdAt: "created_at",
			expiresAt: "expires_at",
			updatedAt: "updated_at",
		},
		modelName: "verification",
	},
};

export const auth: Auth = betterAuth(authOptions);
