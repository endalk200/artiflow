import { NodeServices } from "@effect/platform-node";
import { layerFetch } from "@effect/platform-node/NodeHttpClient";
import { ArtiflowApiClient } from "./api-client.js";
import { ArtiflowConfig } from "./config/index.js";
import { Effect, Layer } from "effect";

import { runCli } from "./cli/run.js";
import { handleCliFailure } from "./runtime/failures.js";
import { withoutConsoleLogger } from "./runtime/telemetry.js";

const ArtiflowConfigLayer = ArtiflowConfig.layer;
const ApiClientLayer = ArtiflowApiClient.Default.pipe(Layer.provide(ArtiflowConfigLayer), Layer.provide(layerFetch));
const MainLayer = Layer.mergeAll(ArtiflowConfigLayer, withoutConsoleLogger, ApiClientLayer).pipe(
	Layer.provideMerge(NodeServices.layer),
);

export const program = runCli.pipe(Effect.provide(MainLayer), Effect.catchTags(handleCliFailure));
