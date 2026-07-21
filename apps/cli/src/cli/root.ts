import { Command } from "effect/unstable/cli";
import { artifactCommand } from "./commands/artifact/index.js";
import { projectCommand } from "./commands/project/index.js";
import { publishCommand } from "./commands/publish.cmd.js";
import { versionCommand } from "./commands/version.cmd.js";

export const commandCatalog = [projectCommand, publishCommand, artifactCommand, versionCommand] as const;

export const makeRootCommand = (commands: typeof commandCatalog = commandCatalog) =>
	Command.make("artiflow").pipe(
		Command.withDescription("Publish agent-authored visual documents to Artiflow."),
		Command.withSubcommands(commands),
	);

export const rootCommand = makeRootCommand();
