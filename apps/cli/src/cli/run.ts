import { Effect, Stdio } from "effect";
import { Command } from "effect/unstable/cli";

import { VERSION } from "../version.js";
import { rootCommand } from "./root.js";

const rootSpanNameFromArgs = (args: ReadonlyArray<string>): string => {
	if (args.includes("--version") || args.includes("-v")) {
		return "artiflow.cli.version";
	}

	const commandArgs = args.filter((arg) => !arg.startsWith("-"));
	const command = commandArgs.length === 0 ? "help" : commandArgs.join(".");

	return `artiflow.cli.${command}`;
};

const commandNameFromRootSpan = (spanName: string): string =>
	spanName.replace("artiflow.cli.", "").replaceAll(".", " ");

const traceCliRun = <E, R>(args: ReadonlyArray<string>, effect: Effect.Effect<void, E, R>) =>
	Effect.suspend(() => {
		const spanName = rootSpanNameFromArgs(args);

		return Effect.gen(function* () {
			yield* Effect.logInfo("Artiflow CLI command started", { args, version: VERSION });
			yield* effect;
		}).pipe(
			Effect.withSpan(spanName, {
				attributes: {
					"cli.command": commandNameFromRootSpan(spanName),
					"artiflow.cli.args": args.join(" "),
					"artiflow.cli.version": VERSION,
				},
			}),
		);
	});

const normalizeCliArgs = (args: ReadonlyArray<string>) => (args.length === 0 ? ["--help"] : args);

export const runCliWithArgs = (args: ReadonlyArray<string>) => {
	const commandArgs = normalizeCliArgs(args);

	return traceCliRun(
		commandArgs,
		Command.runWith(rootCommand, {
			version: VERSION,
		})(commandArgs),
	);
};

export const runCli = Stdio.Stdio.use(({ args }) => Effect.flatMap(args, runCliWithArgs));
