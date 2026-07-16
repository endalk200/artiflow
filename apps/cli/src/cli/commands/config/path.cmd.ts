import { resolveConfigPath } from "../../../config/index.js";
import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";

export const pathCommand = Command.make("path").pipe(
	Command.withDescription("Print the effective Artiflow Configuration path"),
	Command.withShortDescription("Print config path"),
	Command.withHandler(() =>
		Effect.gen(function* () {
			const path = yield* resolveConfigPath();

			yield* Console.log(path.path);
		}).pipe(
			Effect.withSpan("artiflow.cli.config.path", {
				attributes: {
					"cli.command": "config path",
					"artiflow.command": "config path",
				},
			}),
			Effect.annotateLogs({
				"artiflow.command": "config path",
			}),
		),
	),
);
