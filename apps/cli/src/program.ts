import { NodeServices } from "@effect/platform-node";
import { ArtiflowConfig } from "./config/index.js";
import { Effect, Layer } from "effect";

import { runCli } from "./cli/run.js";
import { handleCliFailure } from "./runtime/failures.js";
import { telemetryLayer } from "./runtime/telemetry.js";

const ArtiflowConfigLayer = ArtiflowConfig.layer;
const TelemetryLayer = telemetryLayer.pipe(Layer.provide(ArtiflowConfigLayer));
const MainLayer = Layer.mergeAll(ArtiflowConfigLayer, TelemetryLayer).pipe(Layer.provideMerge(NodeServices.layer));

export const program = runCli.pipe(Effect.provide(MainLayer), Effect.catchTags(handleCliFailure));
