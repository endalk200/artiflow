import { Data, Effect, FileSystem, Path } from "effect";

export const PROJECT_MANIFEST_SCHEMA_VERSION = 1 as const;

export type ProjectManifest = {
	readonly projectId: string;
	readonly schemaVersion: typeof PROJECT_MANIFEST_SCHEMA_VERSION;
};

export type ResolvedProjectManifest = ProjectManifest & {
	readonly directory: string;
	readonly path: string;
};

export class ProjectManifestNotFound extends Data.TaggedError("ProjectManifestNotFound")<{
	readonly startDirectory: string;
}> {}

export class InvalidProjectManifest extends Data.TaggedError("InvalidProjectManifest")<{
	readonly message: string;
	readonly path: string;
}> {}

export class ProjectManifestFileError extends Data.TaggedError("ProjectManifestFileError")<{
	readonly cause: unknown;
	readonly message: string;
	readonly path: string;
}> {}

export class InvalidProjectId extends Data.TaggedError("InvalidProjectId")<{
	readonly projectId: string;
}> {}

const manifestFileError = (path: string, cause: unknown) =>
	new ProjectManifestFileError({
		cause,
		message: cause instanceof Error ? cause.message : String(cause),
		path,
	});

const validateProjectId = (projectId: string) =>
	/^prj_[A-Za-z0-9_-]+$/.test(projectId) ? Effect.succeed(projectId) : Effect.fail(new InvalidProjectId({ projectId }));

const decodeManifest = (path: string, contents: string) =>
	Effect.try({
		try: () => JSON.parse(contents) as unknown,
		catch: (cause) =>
			new InvalidProjectManifest({
				message: cause instanceof Error ? cause.message : "Manifest is not valid JSON.",
				path,
			}),
	}).pipe(
		Effect.flatMap((value) => {
			if (
				typeof value !== "object" ||
				value === null ||
				!("schemaVersion" in value) ||
				value.schemaVersion !== PROJECT_MANIFEST_SCHEMA_VERSION ||
				!("projectId" in value) ||
				typeof value.projectId !== "string" ||
				!/^prj_[A-Za-z0-9_-]+$/.test(value.projectId)
			) {
				return Effect.fail(
					new InvalidProjectManifest({
						message: "Expected schemaVersion 1 and a valid projectId.",
						path,
					}),
				);
			}
			return Effect.succeed({
				projectId: value.projectId,
				schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
			});
		}),
	);

export const findProjectManifest = (
	startDirectory: string = process.cwd(),
): Effect.Effect<
	ResolvedProjectManifest,
	InvalidProjectManifest | ProjectManifestFileError | ProjectManifestNotFound,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const pathService = yield* Path.Path;
		let directory = pathService.resolve(startDirectory);

		while (true) {
			const path = pathService.join(directory, ".artiflow", "project.json");
			const exists = yield* fs.exists(path).pipe(Effect.mapError((cause) => manifestFileError(path, cause)));
			if (exists) {
				const contents = yield* fs
					.readFileString(path)
					.pipe(Effect.mapError((cause) => manifestFileError(path, cause)));
				const manifest = yield* decodeManifest(path, contents);
				return { ...manifest, directory, path };
			}

			const parent = pathService.dirname(directory);
			if (parent === directory) {
				return yield* new ProjectManifestNotFound({ startDirectory });
			}
			directory = parent;
		}
	});

export const writeProjectManifest = (
	projectId: string,
	directory: string = process.cwd(),
): Effect.Effect<
	ResolvedProjectManifest,
	InvalidProjectId | ProjectManifestFileError,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		yield* validateProjectId(projectId);
		const fs = yield* FileSystem.FileSystem;
		const pathService = yield* Path.Path;
		const resolvedDirectory = pathService.resolve(directory);
		const artiflowDirectory = pathService.join(resolvedDirectory, ".artiflow");
		const path = pathService.join(artiflowDirectory, "project.json");
		const ignorePath = pathService.join(artiflowDirectory, ".gitignore");
		const manifest: ProjectManifest = {
			projectId,
			schemaVersion: PROJECT_MANIFEST_SCHEMA_VERSION,
		};

		yield* fs
			.makeDirectory(artiflowDirectory, { recursive: true })
			.pipe(Effect.mapError((cause) => manifestFileError(path, cause)));
		yield* fs
			.writeFileString(path, `${JSON.stringify(manifest, null, 2)}\n`)
			.pipe(Effect.mapError((cause) => manifestFileError(path, cause)));
		const ignoreExists = yield* fs
			.exists(ignorePath)
			.pipe(Effect.mapError((cause) => manifestFileError(ignorePath, cause)));
		const currentIgnore = ignoreExists
			? yield* fs.readFileString(ignorePath).pipe(Effect.mapError((cause) => manifestFileError(ignorePath, cause)))
			: "";
		const ignoreLines = currentIgnore
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);
		if (!ignoreLines.includes("tmp/")) ignoreLines.push("tmp/");
		yield* fs
			.writeFileString(ignorePath, `${ignoreLines.join("\n")}\n`)
			.pipe(Effect.mapError((cause) => manifestFileError(ignorePath, cause)));

		return { ...manifest, directory: resolvedDirectory, path };
	});

export const removeProjectManifest = (
	startDirectory: string = process.cwd(),
): Effect.Effect<
	ResolvedProjectManifest,
	InvalidProjectManifest | ProjectManifestFileError | ProjectManifestNotFound,
	FileSystem.FileSystem | Path.Path
> =>
	Effect.gen(function* () {
		const manifest = yield* findProjectManifest(startDirectory);
		const fs = yield* FileSystem.FileSystem;
		yield* fs.remove(manifest.path).pipe(Effect.mapError((cause) => manifestFileError(manifest.path, cause)));
		return manifest;
	});
