import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { assert, it } from "@effect/vitest"
import {
  Cache,
  ConfigProvider,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Schedule,
  Schema,
  Stream,
} from "effect"
import {
  AsyncResult,
  Atom,
  AtomHttpApi,
  AtomRpc,
} from "effect/unstable/reactivity"

class UserName extends Schema.NonEmptyString {}

const decodeUserName = Schema.decodeUnknownEffect(UserName)
const userName = UserName.make("Ada")

class UserRepository extends Context.Service<
  UserRepository,
  {
    readonly get: (id: string) => Effect.Effect<string>
  }
>()("@validation/UserRepository") {
  static readonly layer = Layer.succeed(
    this,
    UserRepository.of({
      get: Effect.fn("UserRepository.get")((id: string) =>
        Effect.succeed(id)
      ),
    }),
  )
}

const retrySchedule = Schedule.exponential("10 millis").pipe(
  Schedule.upTo({ times: 3 }),
  Schedule.tap(({ input, attempt, duration }) =>
    Effect.logDebug("retry", { input, attempt, duration })
  ),
)

const polled = Stream.fromEffectSchedule(
  Effect.succeed("tick"),
  Schedule.spaced("1 second"),
)

const cacheProgram = Effect.gen(function* () {
  const cache = yield* Cache.makeWith(
    (key: string) => Effect.succeed(key.length),
    {
      capacity: 16,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) ? "1 minute" : Duration.zero,
    },
  )
  const cachedValue = yield* Cache.get(cache, "effect")

  const cachedEffect = yield* Effect.cachedWithTTL(
    Effect.succeed(cachedValue),
    "1 minute",
  )
  return yield* cachedEffect
})

const provider = ConfigProvider.fromEnv({
  env: { EMPTY_IS_A_VALUE: "" },
  preserveEmptyStrings: true,
})

const countAtom = Atom.make(0)
const doubledAtom = Atom.make((get) => get(countAtom) * 2)
const rendered = AsyncResult.builder(AsyncResult.success(userName))
  .onSuccess((name) => name)
  .render()

const effectTest = it.effect("uses the Effect test adapter", () =>
  Effect.sync(() => assert.isTrue(true))
)

void decodeUserName
void UserRepository.layer
void retrySchedule
void polled
void cacheProgram
void provider
void doubledAtom
void rendered
void effectTest
void useAtomSet
void useAtomValue
void AtomHttpApi.Service
void AtomRpc.Service
