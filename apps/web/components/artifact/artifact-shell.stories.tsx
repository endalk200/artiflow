import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ArtifactShell } from "./artifact-shell";
import { Callout, Stat, StatGrid } from "./visual-components";

const meta = {
	title: "Artifacts/Reading Shell",
	parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LatestRevision = {
	render: () => (
		<ArtifactShell
			artifactId="art_story"
			description="A focused visual implementation report."
			project={{ id: "prj_story", name: "Artiflow" }}
			revisionCreatedAt="2026-07-16T12:00:00.000Z"
			revisionNumber={2}
			revisions={[2, 1]}
			sourceFormatVersion={1}
			title="Implementation report"
			toc={[{ depth: 2, title: "Outcome", url: "#outcome" }]}
		>
			<h2 id="outcome">Outcome</h2>
			<p>The vertical tracer now runs from the CLI to a rendered document.</p>
			<Callout title="Complete" type="success">
				Publication is atomic and revision-safe.
			</Callout>
			<StatGrid>
				<Stat
					description="Current authoring contract"
					label="Source format"
					value="1"
				/>
				<Stat
					description="Every documented visual API group"
					label="Component groups"
					value="8"
				/>
				<Stat
					description="One published Artifact"
					label="Expected result"
					value="Pass"
				/>
			</StatGrid>
		</ArtifactShell>
	),
} satisfies Story;
