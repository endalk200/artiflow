import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestConsole } from "effect/testing";
import { HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import * as HttpClientError from "effect/unstable/http/HttpClientError";

import { CLI_EXIT_CODES, handleCliFailure } from "./failures.js";

describe("CLI HTTP failures", () => {
	it.effect("reports a 401 as an actionable authentication failure", () => {
		const request = HttpClientRequest.get("https://app.example/api/projects");
		const error = new HttpClientError.HttpClientError({
			reason: new HttpClientError.StatusCodeError({
				request,
				response: HttpClientResponse.fromWeb(request, new Response(null, { status: 401 })),
			}),
		});

		return Effect.gen(function* () {
			const failure = yield* Effect.flip(handleCliFailure.HttpClientError(error));

			assert.strictEqual(failure.exitCode, CLI_EXIT_CODES.authentication);
			assert.deepStrictEqual(yield* TestConsole.errorLines, [
				'Your Artiflow session is no longer valid. Run "artiflow auth login" again.',
			]);
		}).pipe(Effect.provide(TestConsole.layer));
	});
});
