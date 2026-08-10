import { Clock, Effect, Option } from "effect";

import { ArtiflowConfig } from "../config/index.js";
import { CredentialStore } from "./credential-store.js";
import { MissingCredential } from "./errors.js";

export const requireCredential = Effect.gen(function* () {
	const config = yield* ArtiflowConfig;
	const store = yield* CredentialStore;
	const credential = yield* store.get(config.baseUrl);
	const now = yield* Clock.currentTimeMillis;
	return yield* Option.match(credential, {
		onNone: () => Effect.fail(new MissingCredential({ baseUrl: config.baseUrl })),
		onSome: (value) =>
			Date.parse(value.expiresAt) <= now
				? Effect.fail(new MissingCredential({ baseUrl: config.baseUrl }))
				: Effect.succeed(value),
	});
});
