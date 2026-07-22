import { Effect, Stdio } from "effect";
import { Command } from "effect/unstable/cli";

import { VERSION } from "../version.js";
import { rootCommand } from "./root.js";

const commandMatches = (command: { readonly alias: string | undefined; readonly name: string }, token: string) =>
	command.name === token || command.alias === token;

const subcommandsOf = (command: typeof rootCommand) => command.subcommands.flatMap(({ commands }) => commands);

export const commandNameFromArgs = (args: ReadonlyArray<string>): string => {
	const delimiterIndex = args.indexOf("--");
	const commandArgs = delimiterIndex === -1 ? args : args.slice(0, delimiterIndex);

	if (commandArgs.includes("--version") || commandArgs.includes("-v")) return "version";
	if (commandArgs[0] === "--help" || commandArgs[0] === "-h") return "help";

	const root = commandArgs[0];
	if (root === undefined) return "help";
	const command = subcommandsOf(rootCommand).find((candidate) => commandMatches(candidate, root));
	if (command === undefined) return "unknown";

	const subcommand = commandArgs[1];
	if (subcommand === undefined) return command.name;
	const nestedCommand = command.subcommands
		.flatMap(({ commands }) => commands)
		.find((candidate) => commandMatches(candidate, subcommand));
	return nestedCommand === undefined ? command.name : `${command.name} ${nestedCommand.name}`;
};

const errorType = (error: unknown) =>
	typeof error === "object" &&
	error !== null &&
	"_tag" in error &&
	typeof error._tag === "string" &&
	/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error._tag)
		? error._tag
		: "UnknownError";

export const traceCliRun = <E, R>(args: ReadonlyArray<string>, effect: Effect.Effect<void, E, R>) =>
	Effect.suspend(() => {
		const commandName = commandNameFromArgs(args);
		const spanName = `artiflow.cli.${commandName.replaceAll(" ", ".")}`;
		const annotations = {
			"artiflow.cli.command.name": commandName,
			"artiflow.cli.version": VERSION,
		};

		return Effect.gen(function* () {
			yield* Effect.logInfo("Artiflow CLI command started").pipe(
				Effect.annotateLogs({
					...annotations,
					"artiflow.cli.command.outcome": "started",
				}),
			);
			yield* effect.pipe(
				Effect.tapError((error) => {
					const failureAttributes = {
						...annotations,
						"artiflow.cli.command.outcome": "failed",
						"error.type": errorType(error),
					};
					return Effect.gen(function* () {
						yield* Effect.annotateCurrentSpan(failureAttributes);
						yield* Effect.logWarning("Artiflow CLI command failed").pipe(Effect.annotateLogs(failureAttributes));
					});
				}),
			);
			yield* Effect.annotateCurrentSpan("artiflow.cli.command.outcome", "completed");
			yield* Effect.logInfo("Artiflow CLI command completed").pipe(
				Effect.annotateLogs({
					...annotations,
					"artiflow.cli.command.outcome": "completed",
				}),
			);
		}).pipe(
			Effect.withSpan(spanName, {
				attributes: annotations,
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
