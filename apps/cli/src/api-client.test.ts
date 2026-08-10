import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Option, Redacted } from "effect";
import { Headers, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import * as HttpClientError from "effect/unstable/http/HttpClientError";

import { CredentialStore } from "./auth/credential-store.js";
import { ArtiflowConfig } from "./config/index.js";
import { makeArtiflowApiClient, withTransientRetry } from "./api-client.js";

const statusError = (status: number) => {
	const request = HttpClientRequest.get("https://app.example/api/projects");
	return new HttpClientError.HttpClientError({
		reason: new HttpClientError.StatusCodeError({
			request,
			response: HttpClientResponse.fromWeb(request, new Response(null, { status })),
		}),
	});
};

describe("authenticated Artiflow API client", () => {
	it.effect("adds the saved bearer token to API requests", () => {
		let authorization: string | undefined;
		const httpClient = HttpClient.make((request) =>
			Effect.sync(() => {
				authorization = Option.getOrUndefined(Headers.get(request.headers, "authorization"));
				return HttpClientResponse.fromWeb(
					request,
					Response.json(
						{
							createdAt: "2026-01-01T00:00:00.000Z",
							id: "prj_auth",
							name: "Authenticated",
							updatedAt: "2026-01-01T00:00:00.000Z",
						},
						{ status: 201 },
					),
				);
			}),
		);
		return Effect.gen(function* () {
			const client = yield* makeArtiflowApiClient;
			yield* client.projects.create({
				payload: { idempotencyKey: "auth-test", name: "Authenticated" },
			});

			assert.strictEqual(authorization, "Bearer secret-session-token");
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					Layer.succeed(HttpClient.HttpClient, httpClient),
					Layer.succeed(ArtiflowConfig, {
						baseUrl: "https://app.example",
						telemetryEnabled: false,
					}),
					Layer.succeed(CredentialStore, {
						get: () =>
							Effect.succeed(
								Option.some({
									accessToken: Redacted.make("secret-session-token"),
									expiresAt: "2999-01-01T00:00:00.000Z",
								}),
							),
						remove: () => Effect.void,
						set: () => Effect.void,
					}),
					FileSystem.layerNoop({}),
				),
			),
		);
	});

	it.effect("does not retry a 401 response", () =>
		Effect.gen(function* () {
			let attempts = 0;
			const error = statusError(401);
			const result = yield* Effect.flip(
				withTransientRetry(
					Effect.sync(() => {
						attempts += 1;
					}).pipe(Effect.andThen(Effect.fail(error))),
				),
			);

			assert.strictEqual(result, error);
			assert.strictEqual(attempts, 1);
		}),
	);

	it.effect("removes a credential rejected by the server", () => {
		let removedBaseUrl: string | undefined;
		const httpClient = HttpClient.make((request) =>
			Effect.succeed(HttpClientResponse.fromWeb(request, new Response(null, { status: 401 }))),
		);
		return Effect.gen(function* () {
			const client = yield* makeArtiflowApiClient;
			yield* Effect.flip(
				client.projects.create({
					payload: { idempotencyKey: "revoked-test", name: "Revoked" },
				}),
			);

			assert.strictEqual(removedBaseUrl, "https://app.example");
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					Layer.succeed(HttpClient.HttpClient, httpClient),
					Layer.succeed(ArtiflowConfig, {
						baseUrl: "https://app.example",
						telemetryEnabled: false,
					}),
					Layer.succeed(CredentialStore, {
						get: () =>
							Effect.succeed(
								Option.some({
									accessToken: Redacted.make("revoked-session-token"),
									expiresAt: "2999-01-01T00:00:00.000Z",
								}),
							),
						remove: (baseUrl) =>
							Effect.sync(() => {
								removedBaseUrl = baseUrl;
							}),
						set: () => Effect.void,
					}),
					FileSystem.layerNoop({}),
				),
			),
		);
	});

	it.effect("retries a transient server response", () =>
		Effect.gen(function* () {
			let attempts = 0;
			const error = statusError(503);
			const result = yield* Effect.flip(
				withTransientRetry(
					Effect.sync(() => {
						attempts += 1;
					}).pipe(Effect.andThen(Effect.fail(error))),
				),
			);

			assert.strictEqual(result, error);
			assert.strictEqual(attempts, 3);
		}),
	);
});
