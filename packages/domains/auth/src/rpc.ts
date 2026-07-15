import { Context, Effect, Layer, Schema } from "effect";
import { RpcMiddleware } from "effect/unstable/rpc";

export class AuthenticatedUser extends Context.Service<
	AuthenticatedUser,
	{
		readonly id: string;
		readonly email: string;
		readonly name: string;
	}
>()("app/AuthenticatedUser") {}

export class UnauthorizedError extends Schema.TaggedErrorClass<UnauthorizedError>()(
	"Unauthorized",
	{
		message: Schema.String,
	},
) {}

export class AuthMiddleware extends RpcMiddleware.Service<
	AuthMiddleware,
	{
		readonly provides: AuthenticatedUser;
		readonly error: typeof UnauthorizedError;
	}
>()("app/AuthMiddleware", {
	error: UnauthorizedError,
	requiredForClient: undefined,
}) {}

type SessionUser = {
	readonly id: string;
	readonly email: string;
	readonly name?: string | null;
};

type AuthSession = {
	readonly user: SessionUser;
} | null;

export type ResolveAuthSession = (headers: Headers) => Promise<AuthSession>;

function toWebHeaders(headers: Record<string, string>) {
	const webHeaders = new Headers();

	for (const [key, value] of Object.entries(headers)) {
		webHeaders.set(key, value);
	}

	return webHeaders;
}

export function makeAuthMiddlewareLayer(resolveSession: ResolveAuthSession) {
	return Layer.succeed(
		AuthMiddleware,
		AuthMiddleware.of((effect, options) =>
			Effect.gen(function* () {
				const session = yield* Effect.tryPromise({
					try: () => resolveSession(toWebHeaders(options.headers)),
					catch: () =>
						new UnauthorizedError({
							message: "Authentication is required.",
						}),
				});

				if (!session) {
					return yield* Effect.fail(
						new UnauthorizedError({
							message: "Authentication is required.",
						}),
					);
				}

				return yield* effect.pipe(
					Effect.provideService(
						AuthenticatedUser,
						AuthenticatedUser.of({
							id: session.user.id,
							email: session.user.email,
							name: session.user.name ?? session.user.email,
						}),
					),
				);
			}),
		),
	);
}

export function makeTestAuthMiddlewareLayer(
	user: AuthenticatedUser["Service"] = AuthenticatedUser.of({
		id: "test-user",
		email: "test@example.com",
		name: "Test User",
	}),
) {
	return Layer.succeed(
		AuthMiddleware,
		AuthMiddleware.of((effect) =>
			effect.pipe(Effect.provideService(AuthenticatedUser, user)),
		),
	);
}

export const RejectingAuthMiddlewareTest = Layer.succeed(
	AuthMiddleware,
	AuthMiddleware.of(() =>
		Effect.fail(
			new UnauthorizedError({
				message: "Authentication is required.",
			}),
		),
	),
);
