import { initArtiflowConfig } from "../../../config/index.js";
import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";

export const initCommand = Command.make("init").pipe(
	Command.withDescription("Create a starter Artiflow Configuration file"),
	Command.withShortDescription("Create config file"),
	Command.withHandler(() =>
		Effect.gen(function* () {
			const path = yield* initArtiflowConfig;

			yield* Console.log(`Created Artiflow Configuration at ${path.path}.`);
		}).pipe(
			Effect.withSpan("artiflow.cli.config.init", {
				attributes: {
					"cli.command": "config init",
					"artiflow.command": "config init",
				},
			}),
			Effect.annotateLogs({
				"artiflow.command": "config init",
			}),
		),
	),
);
