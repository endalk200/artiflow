import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import {
	Callout,
	Checklist,
	Comparison,
	FileTree,
	Mermaid,
	Stat,
	StatGrid,
	Step,
	Steps,
	Timeline,
	TimelineItem,
} from "./visual-components";

const meta = {
	title: "Artifacts/Visual Components",
	parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog = {
	play: async ({ canvasElement }) => {
		const checklistItem = canvasElement.querySelector("[data-checklist] li");
		expect(checklistItem).not.toBeNull();
		const checklistItemStyle = window.getComputedStyle(
			checklistItem as Element,
		);
		expect(checklistItemStyle.listStyleType).toBe("none");
		expect(checklistItemStyle.marginTop).toBe("0px");
		expect(checklistItemStyle.marginBottom).toBe("0px");

		const checklist = canvasElement.querySelector("[data-checklist] ul");
		expect(checklist).not.toBeNull();
		const checklistStyle = window.getComputedStyle(checklist as Element);
		expect(checklistStyle.display).toBe("flex");
		expect(checklistStyle.flexDirection).toBe("column");
		expect(checklistStyle.rowGap).toBe("8px");

		const steps = canvasElement.querySelector("ol");
		expect(steps).not.toBeNull();
		expect(window.getComputedStyle(steps as Element).listStyleType).toBe(
			"none",
		);

		const stepHeading = Array.from(canvasElement.querySelectorAll("h3")).find(
			(element) => element.textContent === "Author",
		);
		expect(stepHeading).not.toBeUndefined();
		expect(window.getComputedStyle(stepHeading as Element).marginTop).toBe(
			"0px",
		);
		expect(window.getComputedStyle(stepHeading as Element).marginBottom).toBe(
			"0px",
		);

		const timelineHeading = Array.from(
			canvasElement.querySelectorAll("h3"),
		).find((element) => element.textContent === "Revision 1");
		expect(timelineHeading).not.toBeUndefined();
		expect(window.getComputedStyle(timelineHeading as Element).marginTop).toBe(
			"0px",
		);
		expect(
			window.getComputedStyle(timelineHeading as Element).marginBottom,
		).toBe("0px");

		const statLabel = Array.from(canvasElement.querySelectorAll("p")).find(
			(element) => element.textContent === "Artifact",
		);
		expect(statLabel).not.toBeUndefined();
		expect(window.getComputedStyle(statLabel as Element).marginTop).toBe("0px");
		expect(window.getComputedStyle(statLabel as Element).marginBottom).toBe(
			"0px",
		);
		expect(
			window.getComputedStyle((statLabel as Element).parentElement as Element)
				.marginTop,
		).toBe("0px");

		const statGrid = (statLabel as Element).parentElement?.parentElement;
		expect(statGrid).not.toBeNull();
		expect((statGrid as HTMLElement).scrollWidth).toBeLessThanOrEqual(
			(statGrid as HTMLElement).clientWidth,
		);
	},
	render: () => (
		<div className="artifact-prose mx-auto max-w-4xl space-y-8">
			<Callout title="Decision" type="success">
				The publication boundary is ready.
			</Callout>
			<Steps>
				<Step title="Author">Write one self-contained MDX document.</Step>
				<Step title="Publish">Validate and create an immutable Revision.</Step>
			</Steps>
			<FileTree>{"apps/\n  web/\n  cli/\npackages/\n  api-contract/"}</FileTree>
			<Mermaid chart="graph LR; Agent-->CLI; CLI-->Platform;" />
			<Timeline>
				<TimelineItem title="Revision 1">Initial plan</TimelineItem>
				<TimelineItem title="Revision 2">Completed report</TimelineItem>
			</Timeline>
			<Comparison
				left={<p>Dense agent text</p>}
				right={<p>Visual, navigable Artifact</p>}
			/>
			<Checklist>
				<ul>
					<li>
						<label>
							<input checked readOnly type="checkbox" /> Contract
						</label>
					</li>
					<li>
						<label>
							<input checked readOnly type="checkbox" /> Validation
						</label>
					</li>
				</ul>
			</Checklist>
			<StatGrid>
				<Stat description="Stable identity" label="Artifact" value="1" />
				<Stat description="Immutable history" label="Revisions" value="2" />
				<Stat
					description="Published output"
					label="Expected result"
					value="Pass"
				/>
			</StatGrid>
		</div>
	),
} satisfies Story;
