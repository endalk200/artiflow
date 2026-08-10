import { Clock, Console, Effect, Redacted } from "effect";

import { ArtiflowConfig } from "../config/index.js";
import { BrowserOpener } from "./browser-opener.js";
import { CredentialStore } from "./credential-store.js";
import { DeviceAuthorizationClient, type DeviceAuthorizationClientShape } from "./device-authorization-client.js";
import { DeviceAuthorizationDenied, DeviceAuthorizationExpired, DeviceAuthorizationInvalid } from "./errors.js";

const pollForToken = (
	client: DeviceAuthorizationClientShape,
	deviceCode: string,
	intervalSeconds: number,
): Effect.Effect<
	{ readonly accessToken: string; readonly expiresIn: number },
	| DeviceAuthorizationDenied
	| DeviceAuthorizationExpired
	| DeviceAuthorizationInvalid
	| import("./errors.js").DeviceAuthorizationNetworkError
	| import("./errors.js").DeviceAuthorizationProtocolError
> =>
	Effect.sleep(`${intervalSeconds} seconds`).pipe(
		Effect.andThen(client.pollToken(deviceCode)),
		Effect.flatMap((result) => {
			switch (result._tag) {
				case "authorized":
					return Effect.succeed(result);
				case "authorization_pending":
					return pollForToken(client, deviceCode, intervalSeconds);
				case "slow_down":
					return pollForToken(client, deviceCode, intervalSeconds + 5);
				case "access_denied":
					return Effect.fail(new DeviceAuthorizationDenied());
				case "expired_token":
					return Effect.fail(new DeviceAuthorizationExpired());
				case "invalid_grant":
					return Effect.fail(new DeviceAuthorizationInvalid());
			}
			return Effect.die(new Error("Unknown device authorization response."));
		}),
		Effect.catchTag("DeviceAuthorizationNetworkError", () => pollForToken(client, deviceCode, intervalSeconds)),
	);

export const login = (openBrowser: boolean) =>
	Effect.gen(function* () {
		const config = yield* ArtiflowConfig;
		const client = yield* DeviceAuthorizationClient;
		const credentialStore = yield* CredentialStore;
		const opener = yield* BrowserOpener;
		const authorization = yield* client.requestCode();

		yield* Console.log(`Visit ${authorization.verificationUri}`);
		yield* Console.log(`Enter code: ${authorization.userCode}`);
		if (openBrowser) {
			const opened = yield* opener.open(authorization.verificationUriComplete);
			yield* Console.log(
				opened
					? "Opened the authorization page in your browser."
					: "Could not open a browser; use the URL above to continue.",
			);
		}
		yield* Console.log("Waiting for authorization…");

		const token = yield* pollForToken(client, authorization.deviceCode, authorization.interval).pipe(
			Effect.timeoutOrElse({
				duration: `${authorization.expiresIn} seconds`,
				orElse: () => Effect.fail(new DeviceAuthorizationExpired()),
			}),
		);
		const now = yield* Clock.currentTimeMillis;
		const expiresAt = new Date(now + token.expiresIn * 1000).toISOString();
		yield* credentialStore.set(config.baseUrl, {
			accessToken: Redacted.make(token.accessToken),
			expiresAt,
		});
		yield* Console.log(`Authenticated with ${config.baseUrl}.`);
	});
