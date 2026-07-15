import { describe, expect, it } from "vitest";
import { callbackFrom } from "./callback-url";

describe("callbackFrom", () => {
	it("rejects absolute URLs", () => {
		expect(callbackFrom("https://evil.example/dashboard")).toBe("/");
	});

	it("rejects protocol-relative URLs", () => {
		expect(callbackFrom("//evil.example/dashboard")).toBe("/");
	});

	it("keeps valid internal paths", () => {
		expect(callbackFrom("/posts?filter=recent")).toBe("/posts?filter=recent");
	});
});
