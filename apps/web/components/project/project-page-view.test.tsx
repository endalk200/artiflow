import { assert, describe, it } from "@effect/vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectPageView } from "./project-page-view";

describe("ProjectPageView", () => {
	it("explains the empty state and renders current Artifact metadata", () => {
		const emptyMarkup = renderToStaticMarkup(
			<ProjectPageView
				artifacts={[]}
				project={{ id: "prj_1", name: "Artiflow" }}
			/>,
		);
		assert.include(emptyMarkup, "Publish your first visual Artifact");

		const populatedMarkup = renderToStaticMarkup(
			<ProjectPageView
				artifacts={[
					{
						description: "A visual implementation map",
						id: "art_1",
						revisionCount: 2,
						title: "Implementation plan",
						updatedAt: "2026-07-16T12:00:00.000Z",
					},
				]}
				project={{ id: "prj_1", name: "Artiflow" }}
			/>,
		);
		assert.include(populatedMarkup, 'href="/artifacts/art_1"');
		assert.include(populatedMarkup, "Implementation plan");
		assert.include(populatedMarkup, "2 revisions");
	});
});
