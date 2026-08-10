import { Context, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import { ArtiflowConfig } from "../config/index.js";
import { DeviceAuthorizationNetworkError, DeviceAuthorizationProtocolError } from "./errors.js";

export const DEVICE_AUTHORIZATION_CLIENT_ID = "artiflow-cli";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code" as const;

export type DeviceAuthorizationRequest = {
	readonly deviceCode: string;
	readonly expiresIn: number;
	readonly interval: number;
	readonly userCode: string;
	readonly verificationUri: string;
	readonly verificationUriComplete: string;
};

export type DeviceTokenPoll =
	| {
			readonly _tag: "authorized";
			readonly accessToken: string;
			readonly expiresIn: number;
	  }
	| {
			readonly _tag: "access_denied" | "authorization_pending" | "expired_token" | "invalid_grant" | "slow_down";
			readonly description: string;
	  };

export type DeviceAuthorizationClientShape = {
	readonly pollToken: (
		deviceCode: string,
	) => Effect.Effect<DeviceTokenPoll, DeviceAuthorizationNetworkError | DeviceAuthorizationProtocolError>;
	readonly requestCode: () => Effect.Effect<
		DeviceAuthorizationRequest,
		DeviceAuthorizationNetworkError | DeviceAuthorizationProtocolError
	>;
};

const object = (value: unknown): Record<string, unknown> | undefined =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const stringField = (value: Record<string, unknown>, field: string) =>
	typeof value[field] === "string" ? value[field] : undefined;

const numberField = (value: Record<string, unknown>, field: string) =>
	typeof value[field] === "number" && Number.isFinite(value[field]) ? value[field] : undefined;

const protocolError = () =>
	new DeviceAuthorizationProtocolError({
		message: "The Artiflow auth server returned an invalid response.",
	});

export const makeDeviceAuthorizationClient = Effect.gen(function* () {
	const config = yield* ArtiflowConfig;
	const httpClient = yield* HttpClient.HttpClient;
	const endpoint = (path: string) => `${config.baseUrl}/api/auth${path}`;

	const post = (path: string, body: unknown) =>
		httpClient.execute(HttpClientRequest.post(endpoint(path)).pipe(HttpClientRequest.bodyJsonUnsafe(body))).pipe(
			Effect.mapError(
				(cause) =>
					new DeviceAuthorizationNetworkError({
						cause,
						message: "Could not reach the Artiflow auth server.",
					}),
			),
			Effect.flatMap((response) =>
				response.json.pipe(
					Effect.mapError(
						() =>
							new DeviceAuthorizationProtocolError({
								message: "The Artiflow auth server returned unreadable JSON.",
							}),
					),
				),
			),
		);

	return {
		requestCode: () =>
			post("/device/code", {
				client_id: DEVICE_AUTHORIZATION_CLIENT_ID,
			}).pipe(
				Effect.flatMap((body) => {
					const value = object(body);
					if (value === undefined) return Effect.fail(protocolError());
					const deviceCode = stringField(value, "device_code");
					const userCode = stringField(value, "user_code");
					const verificationUri = stringField(value, "verification_uri");
					const verificationUriComplete = stringField(value, "verification_uri_complete");
					const expiresIn = numberField(value, "expires_in");
					const interval = numberField(value, "interval");
					if (
						deviceCode === undefined ||
						userCode === undefined ||
						verificationUri === undefined ||
						verificationUriComplete === undefined ||
						expiresIn === undefined ||
						interval === undefined ||
						expiresIn <= 0 ||
						interval <= 0
					) {
						return Effect.fail(protocolError());
					}
					let origins: ReadonlyArray<string>;
					try {
						origins = [new URL(verificationUri).origin, new URL(verificationUriComplete).origin];
					} catch {
						return Effect.fail(protocolError());
					}
					if (origins.some((origin) => origin !== new URL(config.baseUrl).origin)) {
						return Effect.fail(protocolError());
					}
					return Effect.succeed({
						deviceCode,
						expiresIn,
						interval,
						userCode,
						verificationUri,
						verificationUriComplete,
					});
				}),
			),
		pollToken: (deviceCode: string) =>
			post("/device/token", {
				client_id: DEVICE_AUTHORIZATION_CLIENT_ID,
				device_code: deviceCode,
				grant_type: DEVICE_GRANT_TYPE,
			}).pipe(
				Effect.flatMap((body): Effect.Effect<DeviceTokenPoll, DeviceAuthorizationProtocolError> => {
					const value = object(body);
					if (value === undefined) return Effect.fail(protocolError());
					const accessToken = stringField(value, "access_token");
					if (accessToken !== undefined && accessToken.length > 0) {
						const expiresIn = numberField(value, "expires_in");
						return expiresIn !== undefined && expiresIn > 0
							? Effect.succeed({
									_tag: "authorized" as const,
									accessToken,
									expiresIn,
								})
							: Effect.fail(protocolError());
					}
					const error = stringField(value, "error");
					const description = stringField(value, "error_description") ?? "Authorization failed.";
					if (
						error === "access_denied" ||
						error === "authorization_pending" ||
						error === "expired_token" ||
						error === "invalid_grant" ||
						error === "slow_down"
					) {
						return Effect.succeed({ _tag: error, description } as DeviceTokenPoll);
					}
					return Effect.fail(protocolError());
				}),
			),
	};
});

export class DeviceAuthorizationClient extends Context.Service<
	DeviceAuthorizationClient,
	DeviceAuthorizationClientShape
>()("DeviceAuthorizationClient") {
	static readonly Default = Layer.effect(DeviceAuthorizationClient, makeDeviceAuthorizationClient);
}
