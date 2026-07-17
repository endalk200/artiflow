import { assert, describe, it } from "@effect/vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ArtifactShell } from "./artifact-shell";

describe("ArtifactShell", () => {
	it("orients the reader with Project, Revision, title, and table of contents", () => {
		const markup = renderToStaticMarkup(
			<ArtifactShell
				artifactId="art_1"
				description="A durable visual plan"
				project={{ id: "prj_1", name: "Artiflow" }}
				revisionCreatedAt="2026-07-16T12:00:00.000Z"
				revisionNumber={2}
				revisions={[2, 1]}
				sourceFormatVersion={1}
				title="Implementation plan"
				toc={[{ depth: 2, title: "Architecture", url: "#architecture" }]}
			>
				<h2 id="architecture">Architecture</h2>
			</ArtifactShell>,
		);

		assert.include(markup, 'href="/projects/prj_1"');
		assert.include(markup, "Implementation plan");
		assert.include(markup, "Revision 2");
		assert.include(markup, "Source Format 1");
		assert.include(markup, "2026-07-16T12:00:00.000Z");
		assert.include(markup, 'href="#architecture"');
	});
});
