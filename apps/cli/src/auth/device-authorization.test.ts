import { assert, describe, it } from "@effect/vitest";
import { Clock, Effect, Fiber, FileSystem, Layer, Redacted, Ref } from "effect";
import { TestConsole, TestClock } from "effect/testing";

import { ArtiflowConfig } from "../config/index.js";
import { BrowserOpener } from "./browser-opener.js";
import { CredentialStore, type StoredCredential } from "./credential-store.js";
import { DeviceAuthorizationClient, type DeviceTokenPoll } from "./device-authorization-client.js";
import { login } from "./device-authorization.js";
import { DeviceAuthorizationNetworkError, type DeviceAuthorizationProtocolError } from "./errors.js";

const authorization = {
	deviceCode: "private-device-code",
	expiresIn: 300,
	interval: 2,
	userCode: "ABCD-EFGH",
	verificationUri: "https://app.example/device",
	verificationUriComplete: "https://app.example/device?user_code=ABCD-EFGH",
};

const baseLayers = (
	pollToken: () => Effect.Effect<DeviceTokenPoll, DeviceAuthorizationNetworkError | DeviceAuthorizationProtocolError>,
	onSave: (credential: StoredCredential) => void,
	opener: (url: string) => Effect.Effect<boolean> = () => Effect.succeed(true),
) =>
	Layer.mergeAll(
		Layer.succeed(ArtiflowConfig, {
			baseUrl: "https://app.example",
			telemetryEnabled: false,
		}),
		Layer.succeed(BrowserOpener, { open: opener }),
		Layer.succeed(DeviceAuthorizationClient, {
			pollToken: () => pollToken(),
			requestCode: () => Effect.succeed(authorization),
		}),
		Layer.succeed(CredentialStore, {
			get: () => Effect.die("get is not used while logging in"),
			remove: () => Effect.die("remove is not used while logging in"),
			set: (_baseUrl, credential) => Effect.sync(() => onSave(credential)),
		}),
		FileSystem.layerNoop({}),
	);

describe("CLI device authorization", () => {
	it.effect("respects pending and slow_down intervals and never prints secrets", () =>
		Effect.gen(function* () {
			const responses = yield* Ref.make<ReadonlyArray<DeviceTokenPoll>>([
				{ _tag: "authorization_pending", description: "pending" },
				{ _tag: "slow_down", description: "slow down" },
				{ _tag: "authorized", accessToken: "private-access-token", expiresIn: 60 },
			]);
			const pollTimes = yield* Ref.make<ReadonlyArray<number>>([]);
			let saved: StoredCredential | undefined;
			const poll = Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				yield* Ref.update(pollTimes, (values) => [...values, now]);
				return yield* Ref.modify(responses, (values) => [
					values[0] ??
						({
							_tag: "invalid_grant",
							description: "No test response configured",
						} satisfies DeviceTokenPoll),
					values.slice(1),
				]);
			});
			const fiber = yield* login(false).pipe(
				Effect.provide(
					baseLayers(
						() => poll,
						(value) => {
							saved = value;
						},
					),
				),
				Effect.forkChild,
			);

			yield* TestClock.adjust("2 seconds");
			yield* TestClock.adjust("2 seconds");
			yield* TestClock.adjust("6 seconds");
			assert.deepStrictEqual(yield* Ref.get(pollTimes), [2_000, 4_000]);
			yield* TestClock.adjust("1 second");
			yield* Fiber.join(fiber);

			assert.deepStrictEqual(yield* Ref.get(pollTimes), [2_000, 4_000, 11_000]);
			assert.isDefined(saved);
			if (saved === undefined) {
				return;
			}
			assert.strictEqual(Redacted.value(saved.accessToken), "private-access-token");
			const output = (yield* TestConsole.logLines).join("\n");
			assert.include(output, authorization.userCode);
			assert.notInclude(output, authorization.deviceCode);
			assert.notInclude(output, "private-access-token");
		}),
	);

	it.effect("falls back to manual instructions when browser opening fails", () =>
		Effect.gen(function* () {
			const openedUrls: string[] = [];
			const fiber = yield* login(true).pipe(
				Effect.provide(
					baseLayers(
						() =>
							Effect.succeed({
								_tag: "authorized",
								accessToken: "token",
								expiresIn: 60,
							}),
						() => {},
						(url) =>
							Effect.sync(() => {
								openedUrls.push(url);
								return false;
							}),
					),
				),
				Effect.forkChild,
			);
			yield* TestClock.adjust("2 seconds");
			yield* Fiber.join(fiber);

			assert.deepStrictEqual(openedUrls, [authorization.verificationUriComplete]);
			assert.include((yield* TestConsole.logLines).join("\n"), "Could not open a browser");
		}),
	);

	it.effect("does not persist credentials when authorization is denied", () =>
		Effect.gen(function* () {
			let saved = false;
			const fiber = yield* login(false).pipe(
				Effect.provide(
					baseLayers(
						() =>
							Effect.succeed({
								_tag: "access_denied",
								description: "denied",
							}),
						() => {
							saved = true;
						},
					),
				),
				Effect.flip,
				Effect.forkChild,
			);
			yield* TestClock.adjust("2 seconds");
			const error = yield* Fiber.join(fiber);

			assert.strictEqual(error._tag, "DeviceAuthorizationDenied");
			assert.isFalse(saved);
		}),
	);

	it.effect("reports expired and invalid grants without persisting a token", () =>
		Effect.gen(function* () {
			for (const expected of [
				{ _tag: "expired_token" as const, errorTag: "DeviceAuthorizationExpired" },
				{ _tag: "invalid_grant" as const, errorTag: "DeviceAuthorizationInvalid" },
			]) {
				let saved = false;
				const fiber = yield* login(false).pipe(
					Effect.provide(
						baseLayers(
							() =>
								Effect.succeed({
									_tag: expected._tag,
									description: "server details are not printed",
								}),
							() => {
								saved = true;
							},
						),
					),
					Effect.flip,
					Effect.forkChild,
				);
				yield* TestClock.adjust("2 seconds");
				const error = yield* Fiber.join(fiber);
				assert.strictEqual(error._tag, expected.errorTag);
				assert.isFalse(saved);
			}
		}),
	);

	it.effect("retries a transient polling network failure", () =>
		Effect.gen(function* () {
			let attempts = 0;
			let saved: StoredCredential | undefined;
			const fiber = yield* login(false).pipe(
				Effect.provide(
					baseLayers(
						() =>
							Effect.suspend(() => {
								attempts += 1;
								return attempts === 1
									? Effect.fail(
											new DeviceAuthorizationNetworkError({
												cause: new Error("offline"),
												message: "Could not reach the Artiflow auth server.",
											}),
										)
									: Effect.succeed({
											_tag: "authorized" as const,
											accessToken: "recovered-token",
											expiresIn: 60,
										});
							}),
						(value) => {
							saved = value;
						},
					),
				),
				Effect.forkChild,
			);
			yield* TestClock.adjust("4 seconds");
			yield* Fiber.join(fiber);

			assert.strictEqual(attempts, 2);
			assert.strictEqual(saved === undefined ? undefined : Redacted.value(saved.accessToken), "recovered-token");
		}),
	);
});
