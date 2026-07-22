import {
	ArtiflowApi,
	RequestSchemaErrorMiddleware,
} from "@app/api-contract/api";
import { InvalidRequest } from "@app/api-contract/models";
import { Context, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiMiddleware } from "effect/unstable/httpapi";

import { ArtifactService } from "../artiflow/artifact-service";
import type { ArtiflowRepository } from "../artiflow/repository";
import { ProjectService } from "../artiflow/project-service";
import { activeTraceContext, effectTelemetryLayer } from "../telemetry/effect";

const ProjectsLive = HttpApiBuilder.group(ArtiflowApi, "projects", (handlers) =>
	Effect.gen(function* () {
		const projects = yield* ProjectService;
		const artifacts = yield* ArtifactService;
		return handlers
			.handle("create", ({ payload }) => projects.create(payload))
			.handle("get", ({ params }) => projects.get(params.projectId))
			.handle("rename", ({ params, payload }) =>
				projects.rename(params.projectId, payload.name),
			)
			.handle("delete", ({ params }) => projects.delete(params.projectId))
			.handle("listArtifacts", ({ params }) => artifacts.list(params.projectId))
			.handle("createArtifact", ({ params, payload }) =>
				artifacts.create(params.projectId, payload),
			);
	}),
);

const ArtifactsLive = HttpApiBuilder.group(
	ArtiflowApi,
	"artifacts",
	(handlers) =>
		Effect.gen(function* () {
			const artifacts = yield* ArtifactService;
			return handlers
				.handle("get", ({ params }) => artifacts.get(params.artifactId))
				.handle("delete", ({ params }) => artifacts.delete(params.artifactId))
				.handle("appendRevision", ({ params, payload }) =>
					artifacts.appendRevision(params.artifactId, payload),
				);
		}),
);

const requestLocation = {
	Headers: "headers",
	Params: "params",
	Payload: "payload",
	Query: "query",
} as const;

const RequestSchemaErrorLive = HttpApiMiddleware.layerSchemaErrorTransform(
	RequestSchemaErrorMiddleware,
	(error) => {
		if (error.kind === "Body") return Effect.fail(error);

		const location = requestLocation[error.kind];
		return Effect.fail(
			new InvalidRequest({
				location,
				message: `Request ${location} does not match the API contract.`,
			}),
		);
	},
);

export const makeApiHandler = <E>(
	repositoryLayer: Layer.Layer<ArtiflowRepository, E>,
) => {
	const ServicesLive = Layer.mergeAll(
		ProjectService.Default,
		ArtifactService.Default,
	).pipe(Layer.provide(repositoryLayer));
	const GroupsLive = Layer.mergeAll(ProjectsLive, ArtifactsLive).pipe(
		Layer.provide(ServicesLive),
	);
	const ApiLive = HttpApiBuilder.layer(ArtiflowApi).pipe(
		Layer.provide(GroupsLive),
		Layer.provide(RequestSchemaErrorLive),
		Layer.provide(HttpServer.layerServices),
	);

	const AppLive = Layer.mergeAll(ApiLive, effectTelemetryLayer);
	const makeWebHandler = () => {
		let initialized = false;
		const webHandler = HttpRouter.toWebHandler(
			AppLive.pipe(
				Layer.tap(() =>
					Effect.sync(() => {
						initialized = true;
					}),
				),
			),
		);
		return {
			...webHandler,
			isInitialized: () => initialized,
		};
	};
	let webHandler = makeWebHandler();

	return {
		dispose: () => webHandler.dispose(),
		handler: (request: Request, requestContext?: Context.Context<never>) => {
			const parentContext = activeTraceContext();
			const effectContext =
				parentContext === undefined
					? requestContext
					: requestContext === undefined
						? parentContext
						: Context.merge(requestContext, parentContext);
			const currentHandler = webHandler;
			return currentHandler
				.handler(request, effectContext as Context.Context<never> | undefined)
				.catch(async (cause: unknown) => {
					if (
						currentHandler === webHandler &&
						!currentHandler.isInitialized()
					) {
						webHandler = makeWebHandler();
						await currentHandler.dispose();
					}
					throw cause;
				});
		},
	};
};
