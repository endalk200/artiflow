import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { Context, Effect, FileSystem, Layer, Option, Redacted } from "effect";

import { CONFIG_PATH_ENV } from "../config/index.js";
import { CredentialStoreError } from "./errors.js";

export const CREDENTIALS_PATH_ENV = "ARTIFLOW_CREDENTIALS_PATH";
export const DEFAULT_CREDENTIALS_PATH = "~/.artiflow/credentials.json";

export type StoredCredential = {
	readonly accessToken: Redacted.Redacted<string>;
	readonly expiresAt: string;
};

export type CredentialStoreShape = {
	readonly get: (
		baseUrl: string,
	) => Effect.Effect<Option.Option<StoredCredential>, CredentialStoreError, FileSystem.FileSystem>;
	readonly remove: (baseUrl: string) => Effect.Effect<void, CredentialStoreError, FileSystem.FileSystem>;
	readonly set: (
		baseUrl: string,
		credential: StoredCredential,
	) => Effect.Effect<void, CredentialStoreError, FileSystem.FileSystem>;
};

type CredentialFile = {
	readonly credentials: Record<string, { readonly accessToken: string; readonly expiresAt: string }>;
	readonly schemaVersion: 1;
};

const expandHome = (path: string) =>
	path === "~" ? homedir() : path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);

export const resolveCredentialsPath = (env: Record<string, string | undefined> = process.env): string => {
	const explicit = env[CREDENTIALS_PATH_ENV];
	if (explicit !== undefined && explicit.trim() !== "") {
		return expandHome(explicit);
	}
	const configured = env[CONFIG_PATH_ENV];
	if (configured !== undefined && configured.trim() !== "") {
		return resolve(dirname(expandHome(configured)), "credentials.json");
	}
	return expandHome(DEFAULT_CREDENTIALS_PATH);
};

const emptyCredentialFile = (): CredentialFile => ({
	credentials: {},
	schemaVersion: 1,
});

const parseCredentialFile = (source: string): CredentialFile => {
	const parsed: unknown = JSON.parse(source);
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("schemaVersion" in parsed) ||
		parsed.schemaVersion !== 1 ||
		!("credentials" in parsed) ||
		typeof parsed.credentials !== "object" ||
		parsed.credentials === null ||
		Array.isArray(parsed.credentials)
	) {
		throw new Error("Unsupported credential file format.");
	}

	const credentials: CredentialFile["credentials"] = {};
	for (const [baseUrl, value] of Object.entries(parsed.credentials)) {
		if (
			typeof value !== "object" ||
			value === null ||
			!("accessToken" in value) ||
			typeof value.accessToken !== "string" ||
			value.accessToken.length === 0 ||
			!("expiresAt" in value) ||
			typeof value.expiresAt !== "string" ||
			!Number.isFinite(Date.parse(value.expiresAt))
		) {
			throw new Error("Invalid credential entry.");
		}
		credentials[baseUrl] = {
			accessToken: value.accessToken,
			expiresAt: value.expiresAt,
		};
	}
	return { credentials, schemaVersion: 1 };
};

const storeError = (path: string, cause: unknown) =>
	new CredentialStoreError({
		cause,
		message: cause instanceof Error ? cause.message : String(cause),
		path,
	});

const invalidCredentialFileError = (path: string) =>
	new CredentialStoreError({
		cause: "Invalid credential file",
		message: "Credential file is invalid.",
		path,
	});

export const makeCredentialStore = (env: Record<string, string | undefined> = process.env): CredentialStoreShape => {
	const path = resolveCredentialsPath(env);
	const directory = dirname(path);

	const read = Effect.fnUntraced(
		function* () {
			const fs = yield* FileSystem.FileSystem;
			const exists = yield* fs.exists(path);
			if (!exists) return emptyCredentialFile();
			const source = yield* fs.readFileString(path);
			return yield* Effect.try({
				try: () => parseCredentialFile(source),
				catch: () => invalidCredentialFileError(path),
			});
		},
		Effect.mapError((cause) => (cause instanceof CredentialStoreError ? cause : storeError(path, cause))),
	);

	const write = (file: CredentialFile) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
			const directoryExists = yield* fs.exists(directory);
			if (!directoryExists) {
				yield* fs.makeDirectory(directory, { mode: 0o700, recursive: true });
				yield* fs.chmod(directory, 0o700);
			}
			yield* fs
				.writeFileString(temporaryPath, `${JSON.stringify(file, null, 2)}\n`, {
					mode: 0o600,
				})
				.pipe(
					Effect.andThen(fs.chmod(temporaryPath, 0o600)),
					Effect.andThen(fs.rename(temporaryPath, path)),
					Effect.andThen(fs.chmod(path, 0o600)),
					Effect.ensuring(fs.remove(temporaryPath, { force: true }).pipe(Effect.ignore)),
				);
		}).pipe(Effect.mapError((cause) => storeError(path, cause)));

	return {
		get: (baseUrl) =>
			Effect.map(read(), (file) => {
				const credential = file.credentials[baseUrl];
				return credential === undefined
					? Option.none()
					: Option.some({
							accessToken: Redacted.make(credential.accessToken),
							expiresAt: credential.expiresAt,
						});
			}),
		remove: (baseUrl) =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				if (!(yield* fs.exists(path))) return;
				const file = yield* read();
				if (!Object.hasOwn(file.credentials, baseUrl)) return;
				const credentials = { ...file.credentials };
				delete credentials[baseUrl];
				yield* write({ credentials, schemaVersion: 1 });
			}).pipe(Effect.mapError((cause) => (cause instanceof CredentialStoreError ? cause : storeError(path, cause)))),
		set: (baseUrl, credential) =>
			Effect.gen(function* () {
				const file = yield* read();
				yield* write({
					credentials: {
						...file.credentials,
						[baseUrl]: {
							accessToken: Redacted.value(credential.accessToken),
							expiresAt: credential.expiresAt,
						},
					},
					schemaVersion: 1,
				});
			}),
	};
};

export class CredentialStore extends Context.Service<CredentialStore, CredentialStoreShape>()("CredentialStore") {
	static readonly layer = Layer.succeed(CredentialStore, makeCredentialStore(process.env));
	static readonly layerFromEnvironment = (env: Record<string, string | undefined>) =>
		Layer.succeed(CredentialStore, makeCredentialStore(env));
}
