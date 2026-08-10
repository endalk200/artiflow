import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { ArtiflowConfig } from "../config/index.js";
import { makeDeviceAuthorizationClient } from "./device-authorization-client.js";

describe("device authorization HTTP client", () => {
	it.effect("rejects verification URLs from a different origin", () => {
		const httpClient = HttpClient.make((request) =>
			Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					Response.json({
						device_code: "device",
						expires_in: 300,
						interval: 5,
						user_code: "ABCD1234",
						verification_uri: "https://attacker.example/device",
						verification_uri_complete: "https://attacker.example/device?user_code=ABCD1234",
					}),
				),
			),
		);

		return Effect.gen(function* () {
			const client = yield* makeDeviceAuthorizationClient;
			const error = yield* Effect.flip(client.requestCode());
			assert.strictEqual(error._tag, "DeviceAuthorizationProtocolError");
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					Layer.succeed(HttpClient.HttpClient, httpClient),
					Layer.succeed(ArtiflowConfig, {
						baseUrl: "https://app.example",
						telemetryEnabled: false,
					}),
				),
			),
		);
	});
});
