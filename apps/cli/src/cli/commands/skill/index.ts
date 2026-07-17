import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { Effect, FileSystem, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { ARTIFLOW_SKILL_FILES } from "../../../skill-template.js";
import { SkillInstallError } from "../../../runtime/command-errors.js";
import { printResult } from "../../output.js";

const LEGACY_ARTIFLOW_SKILL_SHA256 = "ed7604073cdbdb6231ae802da3b68279a3d76c215f089c51a4a5004bc92ddeb3";

const isManagedSkill = (contents: string) => {
	const normalized = contents.replaceAll("\r\n", "\n");
	const closingDelimiter = normalized.indexOf("\n---", 4);
	const frontmatter =
		normalized.startsWith("---\n") && closingDelimiter !== -1 ? normalized.slice(4, closingDelimiter) : "";
	const lines = frontmatter.split("\n");
	const metadataLine = lines.indexOf("metadata:");
	const followingLines = metadataLine === -1 ? [] : lines.slice(metadataLine + 1);
	const nextTopLevelLine = followingLines.findIndex((line) => line.length > 0 && !line.startsWith(" "));
	const metadataLines = nextTopLevelLine === -1 ? followingLines : followingLines.slice(0, nextTopLevelLine);
	const hasManagedMetadata = metadataLine !== -1 && metadataLines.some((line) => line === '  artiflow/managed: "true"');

	return hasManagedMetadata || createHash("sha256").update(normalized).digest("hex") === LEGACY_ARTIFLOW_SKILL_SHA256;
};

const installCommand = Command.make(
	"install",
	{
		force: Flag.boolean("force").pipe(Flag.withDescription("Replace an existing unmanaged Artiflow Skill")),
		global: Flag.boolean("global").pipe(Flag.withDescription("Install for the current user instead of this project")),
		json: Flag.boolean("json").pipe(Flag.withDescription("Print one JSON value")),
	},
	({ force, global, json }) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const pathService = yield* Path.Path;
			const root = global ? homedir() : process.cwd();
			const scope = global ? "global" : "project";
			const directories = [
				pathService.join(root, ".agents", "skills", "artiflow"),
				pathService.join(root, ".claude", "skills", "artiflow"),
			] as const;
			const installations = directories.map((directory) => ({
				directory,
				files: Object.entries(ARTIFLOW_SKILL_FILES).map(([relativePath, contents]) => ({
					contents,
					path: pathService.join(directory, ...relativePath.split("/")),
				})),
			}));
			const files = installations.flatMap((installation) => installation.files);
			const mapError = (path: string) => (cause: unknown) =>
				new SkillInstallError({
					cause,
					message: cause instanceof Error ? cause.message : String(cause),
					path,
				});

			const existingFiles = new Map<string, string>();
			for (const file of files) {
				const exists = yield* fs.exists(file.path).pipe(Effect.mapError(mapError(file.path)));
				if (!exists) continue;
				existingFiles.set(file.path, yield* fs.readFileString(file.path).pipe(Effect.mapError(mapError(file.path))));
			}

			for (const installation of installations) {
				const skillPath = pathService.join(installation.directory, "SKILL.md");
				const existingSkill = existingFiles.get(skillPath);
				const managed = existingSkill !== undefined && isManagedSkill(existingSkill);
				for (const file of installation.files) {
					const existing = existingFiles.get(file.path);
					if (existing === undefined || existing === file.contents || force || managed) continue;
					return yield* new SkillInstallError({
						cause: new Error("Unmanaged Artiflow Skill bundle"),
						message: "An unmanaged Artiflow Skill file already exists. Re-run with --force to replace it.",
						path: file.path,
					});
				}
			}

			const existingFileCount = existingFiles.size;
			const changedFileCount = files.filter((file) => existingFiles.get(file.path) !== file.contents).length;
			const status = changedFileCount === 0 ? "unchanged" : existingFileCount === 0 ? "installed" : "updated";
			if (status !== "unchanged") {
				for (const file of files) {
					yield* fs
						.makeDirectory(pathService.dirname(file.path), { recursive: true })
						.pipe(Effect.mapError(mapError(file.path)));
					yield* fs.writeFileString(file.path, file.contents).pipe(Effect.mapError(mapError(file.path)));
				}
			}

			const paths = files.map((file) => file.path);
			const result = { paths, scope, status };
			const action = status === "unchanged" ? "Already up to date" : status === "updated" ? "Updated" : "Installed";
			yield* printResult(json, result, `${action} the ${scope}-scoped Artiflow Skill at ${directories.join(" and ")}.`);
		}),
).pipe(Command.withDescription("Install or update the explicit-only Artiflow agent Skill"));

export const skillCommand = Command.make("skill").pipe(
	Command.withDescription("Manage the Artiflow agent Skill"),
	Command.withShortDescription("Manage Skill"),
	Command.withSubcommands([installCommand]),
);
