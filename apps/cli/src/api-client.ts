import { ArtiflowApi } from "@app/api-contract/api";
import { Context, Effect, Layer } from "effect";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ArtiflowConfig } from "./config/index.js";

export const makeArtiflowApiClient = Effect.gen(function* () {
	const config = yield* ArtiflowConfig;
	return yield* HttpApiClient.make(ArtiflowApi, { baseUrl: config.baseUrl });
});

export interface ArtiflowApiClientShape extends Effect.Success<typeof makeArtiflowApiClient> {}

export class ArtiflowApiClient extends Context.Service<ArtiflowApiClient, ArtiflowApiClientShape>()(
	"ArtiflowApiClient",
) {
	static readonly Default = Layer.effect(ArtiflowApiClient, makeArtiflowApiClient);
}

const isTransientFailure = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"_tag" in error &&
	(error._tag === "HttpClientError" || error._tag === "InfrastructureError");

export const withTransientRetry = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	effect.pipe(Effect.retry({ times: 2, while: isTransientFailure }));
