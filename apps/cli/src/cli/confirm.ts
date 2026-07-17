import { Console, Effect, Terminal } from "effect";

import { DestructiveConfirmationRequired } from "../runtime/command-errors.js";

export const confirmDestructiveAction = (
	resourceId: string,
	force: boolean,
	json: boolean,
): Effect.Effect<void, DestructiveConfirmationRequired | Terminal.QuitError, Terminal.Terminal> => {
	if (force) return Effect.void;
	if (json) return Effect.fail(new DestructiveConfirmationRequired({ resourceId }));

	return Effect.gen(function* () {
		yield* Console.log(`This permanently deletes ${resourceId}. Type the full ID to continue:`);
		const terminal = yield* Terminal.Terminal;
		const confirmation = yield* terminal.readLine;
		if (confirmation.trim() !== resourceId) {
			return yield* new DestructiveConfirmationRequired({ resourceId });
		}
	});
};
