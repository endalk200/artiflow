import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { createAuthClient, type ReactAuthClient } from "better-auth/react";

type ArtiflowAuthClientOptions = {
	plugins: [ReturnType<typeof deviceAuthorizationClient>];
};

export const authClient: ReactAuthClient<ArtiflowAuthClientOptions> =
	createAuthClient({
		plugins: [deviceAuthorizationClient()],
	});
