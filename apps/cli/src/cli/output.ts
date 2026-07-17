import { Console, type Effect } from "effect";

export const printResult = (json: boolean, value: unknown, human: string): Effect.Effect<void> =>
	Console.log(json ? JSON.stringify(value) : human);
