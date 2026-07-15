"use client";

import { Effect, Layer, ManagedRuntime, Scope } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { PostRpcs } from "../server/post.rpc.definition.ts";

type CreatePostInput = {
	readonly title: string;
	readonly content: string;
};

type UpdatePostInput = {
	readonly id: string;
	readonly title: string;
	readonly content: string;
};

const ClientLayer = RpcClient.layerProtocolHttp({ url: "/api/rpc" }).pipe(
	Layer.provide(RpcSerialization.layerJson),
	Layer.provide(FetchHttpClient.layer),
);

const runtime = ManagedRuntime.make(ClientLayer);
const makePostRpcClient = RpcClient.make(PostRpcs);

function runPostRpc<A, E>(
	effect: Effect.Effect<A, E, RpcClient.Protocol | Scope.Scope>,
): Promise<A> {
	return runtime.runPromise(Effect.scoped(effect));
}

export const PostClient = {
	list: () =>
		runPostRpc(
			Effect.flatMap(makePostRpcClient, (client) => client["Post.List"]()),
		),

	create: (input: CreatePostInput) =>
		runPostRpc(
			Effect.flatMap(makePostRpcClient, (client) =>
				client["Post.Create"](input),
			),
		),

	update: (input: UpdatePostInput) =>
		runPostRpc(
			Effect.flatMap(makePostRpcClient, (client) =>
				client["Post.Update"](input),
			),
		),

	delete: (id: string) =>
		runPostRpc(
			Effect.flatMap(makePostRpcClient, (client) =>
				client["Post.Delete"]({ id }),
			),
		),

	dispose: () => runtime.dispose(),
};
