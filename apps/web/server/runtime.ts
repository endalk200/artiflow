import { type Effect, Layer, ManagedRuntime } from "effect";

import { ArtifactService } from "./artiflow/artifact-service";
import { ProjectService } from "./artiflow/project-service";
import { postgresRepositoryLayer } from "./database/postgres-repository";
import { continueActiveTrace, effectTelemetryLayer } from "./telemetry/effect";

export const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://artiflow:artiflow@localhost:5432/artiflow";

const RepositoryLive = postgresRepositoryLayer(databaseUrl);

const artiflowRuntime = ManagedRuntime.make(
	Layer.mergeAll(
		ProjectService.Default,
		ArtifactService.Default,
		effectTelemetryLayer,
	).pipe(Layer.provide(RepositoryLive)),
);

type ArtiflowRuntimeServices = ManagedRuntime.ManagedRuntime.Services<
	typeof artiflowRuntime
>;

/** Runs a server Effect while preserving the active Next.js trace as its parent. */
export const runArtiflow = <A, E>(
	effect: Effect.Effect<A, E, ArtiflowRuntimeServices>,
) => artiflowRuntime.runPromise(continueActiveTrace(effect));
