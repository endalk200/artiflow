import { describe, expect, it } from "vitest";

import { isDefined } from "./index.ts";

describe("isDefined", () => {
	it("narrows away null and undefined values", () => {
		const values = ["alpha", null, "beta", undefined];

		const result = values.filter(isDefined);

		expect(result).toEqual(["alpha", "beta"]);
	});
});
