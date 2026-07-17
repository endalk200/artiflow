// @vitest-environment jsdom

import { assert, describe, it } from "@effect/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { vi } from "vitest";

const mermaid = vi.hoisted(() => {
	let theme = "neutral";
	return {
		initialize: vi.fn((options: { readonly theme: string }) => {
			theme = options.theme;
		}),
		render: vi.fn(async () => ({
			svg: `<svg data-rendered-theme="${theme}"></svg>`,
		})),
	};
});

vi.mock("mermaid", () => ({ default: mermaid }));

import { MermaidDiagram } from "./mermaid-diagram";

describe("MermaidDiagram", () => {
	it("rerenders when the reader changes their color scheme", async () => {
		(
			globalThis as typeof globalThis & {
				IS_REACT_ACT_ENVIRONMENT: boolean;
			}
		).IS_REACT_ACT_ENVIRONMENT = true;
		let prefersDark = true;
		const listeners = new Set<(event: MediaQueryListEvent) => void>();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				addEventListener: (
					_type: "change",
					listener: (event: MediaQueryListEvent) => void,
				) => listeners.add(listener),
				dispatchEvent: () => true,
				get matches() {
					return prefersDark;
				},
				media: "(prefers-color-scheme: dark)",
				onchange: null,
				removeEventListener: (
					_type: "change",
					listener: (event: MediaQueryListEvent) => void,
				) => listeners.delete(listener),
			})),
		);

		const container = document.createElement("div");
		const root = createRoot(container);
		await act(async () =>
			root.render(<MermaidDiagram chart="flowchart LR; A-->B;" />),
		);
		await vi.waitFor(() =>
			assert.strictEqual(
				container
					.querySelector('[role="img"] svg')
					?.getAttribute("data-rendered-theme"),
				"dark",
			),
		);

		prefersDark = false;
		await act(async () => {
			for (const listener of listeners) {
				listener({ matches: prefersDark } as MediaQueryListEvent);
			}
		});
		await vi.waitFor(() =>
			assert.strictEqual(
				container
					.querySelector('[role="img"] svg')
					?.getAttribute("data-rendered-theme"),
				"neutral",
			),
		);

		await act(async () => root.unmount());
		vi.unstubAllGlobals();
	});
});
