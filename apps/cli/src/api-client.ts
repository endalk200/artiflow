import { ArtiflowApi } from "@app/api-contract/api";
import { Clock, Context, Effect, Layer, Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ArtiflowConfig } from "./config/index.js";
import { CredentialStore } from "./auth/credential-store.js";
import { MissingCredential } from "./auth/errors.js";

type ArtiflowApiGroups = (typeof ArtiflowApi.groups)[keyof typeof ArtiflowApi.groups];
type RawArtiflowApiClient = HttpApiClient.Client<ArtiflowApiGroups>;

const responseStatus = (error: unknown): number | undefined => {
	if (typeof error !== "object" || error === null || !("reason" in error)) return undefined;
	const reason = error.reason;
	if (typeof reason !== "object" || reason === null || !("response" in reason)) return undefined;
	const response = reason.response;
	if (typeof response !== "object" || response === null || !("status" in response)) return undefined;
	return typeof response.status === "number" ? response.status : undefined;
};

export const makeArtiflowApiClient = Effect.gen(function* () {
	const config = yield* ArtiflowConfig;
	const credentialStore = yield* CredentialStore;
	const httpClient = yield* HttpClient.HttpClient;
	const withClient = (
		use: (client: RawArtiflowApiClient) => Effect.Effect<unknown, unknown, unknown>,
	): Effect.Effect<unknown, unknown, unknown> =>
		Effect.gen(function* () {
			const credential = yield* credentialStore.get(config.baseUrl);
			const now = yield* Clock.currentTimeMillis;
			if (credential._tag === "None" || Date.parse(credential.value.expiresAt) <= now) {
				return yield* Effect.fail(new MissingCredential({ baseUrl: config.baseUrl }));
			}
			return yield* HttpApiClient.makeWith(ArtiflowApi, {
				baseUrl: config.baseUrl,
				httpClient: httpClient.pipe(
					HttpClient.mapRequest((request) =>
						HttpClientRequest.bearerToken(request, Redacted.value(credential.value.accessToken)),
					),
				),
			}).pipe(
				Effect.flatMap(use),
				Effect.tapError((error) =>
					responseStatus(error) === 401 ? credentialStore.remove(config.baseUrl) : Effect.void,
				),
			);
		});

	const client = {
		artifacts: {
			appendRevision: (request: unknown) => withClient((value) => value.artifacts.appendRevision(request as never)),
			delete: (request: unknown) => withClient((value) => value.artifacts.delete(request as never)),
			get: (request: unknown) => withClient((value) => value.artifacts.get(request as never)),
		},
		projects: {
			create: (request: unknown) => withClient((value) => value.projects.create(request as never)),
			createArtifact: (request: unknown) => withClient((value) => value.projects.createArtifact(request as never)),
			delete: (request: unknown) => withClient((value) => value.projects.delete(request as never)),
			get: (request: unknown) => withClient((value) => value.projects.get(request as never)),
			listArtifacts: (request: unknown) => withClient((value) => value.projects.listArtifacts(request as never)),
			rename: (request: unknown) => withClient((value) => value.projects.rename(request as never)),
		},
	};
	return client as unknown as RawArtiflowApiClient;
});

export interface ArtiflowApiClientShape extends Effect.Success<typeof makeArtiflowApiClient> {}

export class ArtiflowApiClient extends Context.Service<ArtiflowApiClient, ArtiflowApiClientShape>()(
	"ArtiflowApiClient",
) {
	static readonly Default = Layer.effect(ArtiflowApiClient, makeArtiflowApiClient);
}

const isTransientFailure = (error: unknown): boolean => {
	if (typeof error !== "object" || error === null || !("_tag" in error)) return false;
	if (error._tag === "InfrastructureError") return true;
	if (error._tag !== "HttpClientError" || !("reason" in error)) return false;
	const reason = error.reason;
	if (typeof reason !== "object" || reason === null || !("_tag" in reason)) return false;
	if (reason._tag === "TransportError") return true;
	if (reason._tag !== "StatusCodeError" || !("response" in reason)) return false;
	const status = responseStatus(error);
	return status === 408 || status === 429 || (status !== undefined && status >= 500);
};

export const withTransientRetry = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(Effect.retry({ times: 2, while: isTransientFailure }));
