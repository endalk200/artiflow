import { NodeServices } from "@effect/platform-node";
import { layerFetch } from "@effect/platform-node/NodeHttpClient";
import { ArtiflowApiClient } from "./api-client.js";
import { BrowserOpener } from "./auth/browser-opener.js";
import { CredentialStore } from "./auth/credential-store.js";
import { DeviceAuthorizationClient } from "./auth/device-authorization-client.js";
import { ArtiflowConfig } from "./config/index.js";
import { Effect, Layer } from "effect";

import { runCli } from "./cli/run.js";
import { handleCliFailure } from "./runtime/failures.js";
import { telemetryLayer } from "./runtime/telemetry.js";

const ArtiflowConfigLayer = ArtiflowConfig.layer;
const ApiClientLayer = ArtiflowApiClient.Default.pipe(Layer.provide(layerFetch));
const DeviceAuthorizationClientLayer = DeviceAuthorizationClient.Default.pipe(Layer.provide(layerFetch));
const ApplicationLayer = Layer.mergeAll(
	ApiClientLayer,
	BrowserOpener.layer,
	CredentialStore.layer,
	DeviceAuthorizationClientLayer,
	telemetryLayer,
).pipe(
	Layer.provideMerge(ArtiflowConfigLayer),
	Layer.provideMerge(CredentialStore.layer),
	Layer.provideMerge(NodeServices.layer),
);

export const program = runCli.pipe(Effect.provide(ApplicationLayer), Effect.catchTags(handleCliFailure));
