import { describe, expect, it } from "vitest";

import { safeCallbackURL } from "./callback-url";

describe("safeCallbackURL", () => {
	it("preserves local paths, queries, and fragments", () => {
		expect(safeCallbackURL("/device?user_code=ABCD1234#confirm")).toBe(
			"/device?user_code=ABCD1234#confirm",
		);
	});

	it.each([
		undefined,
		["/projects"],
		"https://example.com/projects",
		"javascript:alert(1)",
		"data:text/html,unsafe",
		"//example.com/projects",
		"/\\example.com/projects",
		"/%2f%2fexample.com/projects",
		"/%5cexample.com/projects",
		"/projects%0d%0aSet-Cookie:unsafe=true",
		"/%",
	])("rejects an unsafe callback URL: %j", (value) => {
		expect(safeCallbackURL(value)).toBe("/projects");
	});

	it("supports a caller-provided fallback", () => {
		expect(safeCallbackURL(undefined, "/")).toBe("/");
	});
});
