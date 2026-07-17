import { assert, describe, it } from "@effect/vitest";
import { renderToStaticMarkup } from "react-dom/server";

import NotFound from "./not-found";

describe("Artiflow not-found page", () => {
	it("gives readers a branded recovery path", () => {
		const markup = renderToStaticMarkup(<NotFound />);

		assert.include(markup, "Artiflow");
		assert.include(markup, "This Artiflow page isn’t available");
		assert.include(markup, "It may have been deleted");
		assert.include(markup, 'href="/"');
		assert.include(markup, "Return home");
	});
});
