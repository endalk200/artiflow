import { Layer, ManagedRuntime } from "effect";

import { ArtifactService } from "./artiflow/artifact-service";
import { ProjectService } from "./artiflow/project-service";
import { postgresRepositoryLayer } from "./database/postgres-repository";

export const databaseUrl =
	process.env.DATABASE_URL ??
	"postgresql://artiflow:artiflow@localhost:5432/artiflow";

const RepositoryLive = postgresRepositoryLayer(databaseUrl);

export const artiflowRuntime = ManagedRuntime.make(
	Layer.mergeAll(ProjectService.Default, ArtifactService.Default).pipe(
		Layer.provide(RepositoryLive),
	),
);
