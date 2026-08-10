import { NodeFileSystem } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Option, Redacted } from "effect";

import { CREDENTIALS_PATH_ENV, makeCredentialStore } from "./credential-store.js";

describe("CLI credential store", () => {
	it.effect("persists credentials per base URL with restrictive permissions", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped({
				prefix: "artiflow-credentials-",
			});
			const path = `${directory}/private/credentials.json`;
			const store = makeCredentialStore({ [CREDENTIALS_PATH_ENV]: path });

			yield* store.set("https://one.example", {
				accessToken: Redacted.make("token-one"),
				expiresAt: "2030-01-01T00:00:00.000Z",
			});
			yield* store.set("https://two.example", {
				accessToken: Redacted.make("token-two"),
				expiresAt: "2031-01-01T00:00:00.000Z",
			});

			const one = yield* store.get("https://one.example");
			assert.isTrue(Option.isSome(one));
			if (Option.isSome(one)) {
				assert.strictEqual(Redacted.value(one.value.accessToken), "token-one");
			}

			assert.strictEqual((yield* fs.stat(`${directory}/private`)).mode & 0o777, 0o700);
			assert.strictEqual((yield* fs.stat(path)).mode & 0o777, 0o600);

			yield* store.remove("https://one.example");
			assert.isTrue(Option.isNone(yield* store.get("https://one.example")));
			const two = yield* store.get("https://two.example");
			assert.isTrue(Option.isSome(two));
			if (Option.isSome(two)) {
				assert.strictEqual(Redacted.value(two.value.accessToken), "token-two");
			}
		}).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
	);

	it.effect("rejects malformed credential files without exposing their contents", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped({
				prefix: "artiflow-credentials-invalid-",
			});
			const path = `${directory}/credentials.json`;
			yield* fs.writeFileString(path, '{"secret":"must-not-appear", broken');
			const store = makeCredentialStore({ [CREDENTIALS_PATH_ENV]: path });
			const error = yield* Effect.flip(store.get("https://example.com"));

			assert.strictEqual(error._tag, "CredentialStoreError");
			assert.notInclude(error.message, "must-not-appear");
		}).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
	);

	it.effect("preserves the mode of an existing credential parent directory", () =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const directory = yield* fs.makeTempDirectoryScoped({
				prefix: "artiflow-credentials-existing-",
			});
			yield* fs.chmod(directory, 0o755);
			const path = `${directory}/credentials.json`;
			const store = makeCredentialStore({ [CREDENTIALS_PATH_ENV]: path });

			yield* store.set("https://example.com", {
				accessToken: Redacted.make("token"),
				expiresAt: "2030-01-01T00:00:00.000Z",
			});

			assert.strictEqual((yield* fs.stat(directory)).mode & 0o777, 0o755);
			assert.strictEqual((yield* fs.stat(path)).mode & 0o777, 0o600);
		}).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
	);
});
