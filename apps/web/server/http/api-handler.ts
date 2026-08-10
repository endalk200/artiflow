import {
	ArtiflowApi,
	RequestSchemaErrorMiddleware,
} from "@app/api-contract/api";
import { InvalidRequest } from "@app/api-contract/models";
import { Context, Effect, Layer } from "effect";
import {
	HttpRouter,
	HttpServer,
	HttpServerRequest,
} from "effect/unstable/http";
import { HttpApiBuilder, HttpApiMiddleware } from "effect/unstable/httpapi";

import { ArtifactService } from "../artiflow/artifact-service";
import type { ArtiflowRepository } from "../artiflow/repository";
import { ProjectService } from "../artiflow/project-service";
import { activeTraceContext, effectTelemetryLayer } from "../telemetry/effect";

const OWNER_USER_ID_HEADER = "x-artiflow-owner-user-id";

const ownerUserId = HttpServerRequest.HttpServerRequest.pipe(
	Effect.map((request) => request.headers[OWNER_USER_ID_HEADER]),
	Effect.flatMap((value) =>
		value === undefined
			? Effect.die("Authenticated owner context is missing.")
			: Effect.succeed(value),
	),
);

const ProjectsLive = HttpApiBuilder.group(ArtiflowApi, "projects", (handlers) =>
	Effect.gen(function* () {
		const projects = yield* ProjectService;
		const artifacts = yield* ArtifactService;
		return handlers
			.handle("create", ({ payload }) =>
				Effect.flatMap(ownerUserId, (owner) => projects.create(owner, payload)),
			)
			.handle("get", ({ params }) =>
				Effect.flatMap(ownerUserId, (owner) =>
					projects.get(owner, params.projectId),
				),
			)
			.handle("rename", ({ params, payload }) =>
				Effect.flatMap(ownerUserId, (owner) =>
					projects.rename(owner, params.projectId, payload.name),
				),
			)
			.handle("delete", ({ params }) =>
				Effect.flatMap(ownerUserId, (owner) =>
					projects.delete(owner, params.projectId),
				),
			)
			.handle("listArtifacts", ({ params }) =>
				Effect.flatMap(ownerUserId, (owner) =>
					artifacts.list(owner, params.projectId),
				),
			)
			.handle("createArtifact", ({ params, payload }) =>
				Effect.flatMap(ownerUserId, (owner) =>
					artifacts.create(owner, params.projectId, payload),
				),
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
				.handle("get", ({ params }) =>
					Effect.flatMap(ownerUserId, (owner) =>
						artifacts.get(owner, params.artifactId),
					),
				)
				.handle("delete", ({ params }) =>
					Effect.flatMap(ownerUserId, (owner) =>
						artifacts.delete(owner, params.artifactId),
					),
				)
				.handle("appendRevision", ({ params, payload }) =>
					Effect.flatMap(ownerUserId, (owner) =>
						artifacts.appendRevision(owner, params.artifactId, payload),
					),
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

type RecoverableWebHandler = {
	readonly dispose: () => Promise<void>;
	readonly handler: (
		request: Request,
		requestContext?: Context.Context<never>,
	) => Promise<Response>;
	readonly isInitialized: () => boolean;
};

export const makeRecoveringWebHandler = (
	makeWebHandler: () => RecoverableWebHandler,
	reportDisposalFailure: (cause: unknown) => void = (cause) =>
		console.error(
			"Failed to dispose API handler after initialization failure.",
			cause,
		),
) => {
	let webHandler = makeWebHandler();
	return {
		dispose: () => webHandler.dispose(),
		handler: (request: Request, requestContext?: Context.Context<never>) => {
			const currentHandler = webHandler;
			return currentHandler
				.handler(request, requestContext)
				.catch(async (cause: unknown) => {
					if (
						currentHandler === webHandler &&
						!currentHandler.isInitialized()
					) {
						webHandler = makeWebHandler();
						try {
							await currentHandler.dispose();
						} catch (disposalCause) {
							try {
								reportDisposalFailure(disposalCause);
							} catch {
								// Reporting is best-effort; preserve the initialization failure.
							}
						}
					}
					throw cause;
				});
		},
	};
};

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
	const webHandler = makeRecoveringWebHandler(makeWebHandler);

	return {
		dispose: () => webHandler.dispose(),
		handler: (
			request: Request,
			owner: string,
			requestContext?: Context.Context<never>,
		) => {
			const headers = new Headers(request.headers);
			headers.set(OWNER_USER_ID_HEADER, owner);
			const authenticatedRequest = new Request(request, { headers });
			const parentContext = activeTraceContext();
			const effectContext =
				parentContext === undefined
					? requestContext
					: requestContext === undefined
						? parentContext
						: Context.merge(requestContext, parentContext);
			return webHandler.handler(
				authenticatedRequest,
				effectContext as Context.Context<never> | undefined,
			);
		},
	};
};
