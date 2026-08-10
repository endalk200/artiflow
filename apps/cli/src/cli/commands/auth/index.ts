import { Clock, Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { login } from "../../../auth/device-authorization.js";
import { CredentialStore } from "../../../auth/credential-store.js";
import { ArtiflowConfig } from "../../../config/index.js";
import { printResult } from "../../output.js";

const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Print one JSON value"));

const loginCommand = Command.make(
	"login",
	{
		noOpen: Flag.boolean("no-open").pipe(Flag.withDescription("Do not open a browser automatically")),
	},
	({ noOpen }) => login(!noOpen),
).pipe(Command.withDescription("Authenticate this CLI through your browser"));

const statusCommand = Command.make("status", { json: jsonFlag }, ({ json }) =>
	Effect.gen(function* () {
		const config = yield* ArtiflowConfig;
		const store = yield* CredentialStore;
		const credential = yield* store.get(config.baseUrl);
		const now = yield* Clock.currentTimeMillis;
		const authenticated = Option.exists(credential, (value) => Date.parse(value.expiresAt) > now);
		const expiresAt = Option.match(credential, {
			onNone: () => undefined,
			onSome: (value) => value.expiresAt,
		});
		yield* printResult(
			json,
			{ authenticated, baseUrl: config.baseUrl, expiresAt },
			authenticated
				? `Authenticated with ${config.baseUrl} until ${expiresAt}.`
				: `Not authenticated with ${config.baseUrl}. Run "artiflow auth login".`,
		);
	}),
).pipe(Command.withDescription("Show authentication status"));

const logoutCommand = Command.make("logout", { json: jsonFlag }, ({ json }) =>
	Effect.gen(function* () {
		const config = yield* ArtiflowConfig;
		const store = yield* CredentialStore;
		yield* store.remove(config.baseUrl);
		if (json) {
			yield* Console.log(JSON.stringify({ baseUrl: config.baseUrl, authenticated: false }));
		} else {
			yield* Console.log(`Logged out from ${config.baseUrl}.`);
		}
	}),
).pipe(Command.withDescription("Remove this CLI's saved credential"));

export const authCommand = Command.make("auth").pipe(
	Command.withDescription("Manage CLI authentication"),
	Command.withShortDescription("Manage authentication"),
	Command.withSubcommands([loginCommand, statusCommand, logoutCommand]),
);
