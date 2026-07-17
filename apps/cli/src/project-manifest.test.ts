import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

import { findProjectManifest, writeProjectManifest } from "./project-manifest.js";

const testFileSystem = (files: Record<string, string>) =>
	Layer.merge(
		FileSystem.layerNoop({
			exists: (path) => Effect.succeed(Object.hasOwn(files, String(path))),
			makeDirectory: () => Effect.void,
			readFileString: (path) => Effect.succeed(files[String(path)] ?? ""),
			writeFileString: (path, data) =>
				Effect.sync(() => {
					files[String(path)] = data;
				}),
		}),
		Path.layer,
	);

describe("local Project manifest", () => {
	it.effect("selects the nearest ancestor without consulting Git or directory names", () => {
		const files = {
			"/work/.artiflow/project.json": '{"schemaVersion":1,"projectId":"prj_parent"}',
			"/work/packages/app/.artiflow/project.json": '{"schemaVersion":1,"projectId":"prj_nearest"}',
		};
		return Effect.gen(function* () {
			const resolved = yield* findProjectManifest("/work/packages/app/src/features");

			assert.strictEqual(resolved.projectId, "prj_nearest");
			assert.strictEqual(resolved.directory, "/work/packages/app");
		}).pipe(Effect.provide(testFileSystem(files)));
	});

	it.effect("writes the committed binding and ignores only temporary authoring files", () => {
		const files: Record<string, string> = {};
		return Effect.gen(function* () {
			const manifest = yield* writeProjectManifest("prj_created", "/work/product");

			assert.strictEqual(manifest.projectId, "prj_created");
			assert.deepStrictEqual(JSON.parse(files["/work/product/.artiflow/project.json"] ?? ""), {
				projectId: "prj_created",
				schemaVersion: 1,
			});
			assert.strictEqual(files["/work/product/.artiflow/.gitignore"], "tmp/\n");
		}).pipe(Effect.provide(testFileSystem(files)));
	});

	it.effect("reports a malformed nearest manifest instead of skipping it", () => {
		const files = {
			"/work/.artiflow/project.json": '{"schemaVersion":1,"projectId":"prj_parent"}',
			"/work/app/.artiflow/project.json": '{"schemaVersion":2,"projectId":"prj_bad"}',
		};
		return Effect.gen(function* () {
			const error = yield* Effect.flip(findProjectManifest("/work/app/src"));

			assert.strictEqual(error._tag, "InvalidProjectManifest");
		}).pipe(Effect.provide(testFileSystem(files)));
	});
});
