import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button.js";

describe("Button", () => {
	it("renders children as an accessible button", () => {
		render(<Button>Save changes</Button>);

		expect(
			screen.getByRole("button", { name: "Save changes" }),
		).toBeInTheDocument();
	});

	it("marks the button slot and merges custom classes", () => {
		render(
			<Button className="w-full" size="lg" variant="outline">
				Open menu
			</Button>,
		);

		const button = screen.getByRole("button", { name: "Open menu" });

		expect(button).toHaveAttribute("data-slot", "button");
		expect(button).toHaveClass("w-full");
	});

	it("calls the click handler when enabled", () => {
		const handleClick = vi.fn();

		render(<Button onClick={handleClick}>Continue</Button>);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));

		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("does not call the click handler when disabled", () => {
		const handleClick = vi.fn();

		render(
			<Button disabled onClick={handleClick}>
				Continue
			</Button>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));

		expect(handleClick).not.toHaveBeenCalled();
	});
});
