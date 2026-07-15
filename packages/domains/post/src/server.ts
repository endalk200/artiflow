/**
 * Server-only entry point for wiring the post domain into an application RPC
 * server.
 */
export { PostRepositoryPrisma } from "./server/post.repository.ts";
export { PostRpcs } from "./server/post.rpc.definition.ts";
export { PostHandlers } from "./server/post.rpc.handler.ts";
export { PostOperationsLive } from "./server/post.service.ts";
