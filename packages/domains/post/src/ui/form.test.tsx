import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostForm } from "./form.tsx";

describe("PostForm", () => {
	it("renders create mode", () => {
		render(
			<PostForm
				initialValue={{ title: "", content: "" }}
				isEditing={false}
				isPending={false}
				onCancel={vi.fn()}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(
			screen.getByRole("heading", { name: "Create Post" }),
		).toBeInTheDocument();

		fireEvent.change(screen.getByPlaceholderText("Enter title"), {
			target: { value: "Draft" },
		});

		expect(screen.getByDisplayValue("Draft")).toBeInTheDocument();
	});

	it("renders edit mode and disables save while pending", () => {
		render(
			<PostForm
				initialValue={{ title: "Existing", content: "Body" }}
				isEditing
				isPending
				onCancel={vi.fn()}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Edit Post" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
	});

	it("shows validation messages on blur for whitespace-only fields", async () => {
		render(
			<PostForm
				initialValue={{ title: "", content: "" }}
				isEditing={false}
				isPending={false}
				onCancel={vi.fn()}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		fireEvent.change(screen.getByPlaceholderText("Enter title"), {
			target: { value: "   " },
		});
		fireEvent.blur(screen.getByPlaceholderText("Enter title"));
		fireEvent.change(
			screen.getByPlaceholderText("Write your content here..."),
			{
				target: { value: "\t" },
			},
		);
		fireEvent.blur(screen.getByPlaceholderText("Write your content here..."));

		expect(await screen.findByText("Title is required.")).toBeInTheDocument();
		expect(screen.getByText("Content is required.")).toBeInTheDocument();
	});

	it("does not submit invalid whitespace-only values", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);

		render(
			<PostForm
				initialValue={{ title: "", content: "" }}
				isEditing={false}
				isPending={false}
				onCancel={vi.fn()}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.change(screen.getByPlaceholderText("Enter title"), {
			target: { value: "   " },
		});
		fireEvent.change(
			screen.getByPlaceholderText("Write your content here..."),
			{
				target: { value: "   " },
			},
		);
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(onSubmit).not.toHaveBeenCalled();
		});
	});

	it("submits trimmed values", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);

		render(
			<PostForm
				initialValue={{ title: "", content: "" }}
				isEditing={false}
				isPending={false}
				onCancel={vi.fn()}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.change(screen.getByPlaceholderText("Enter title"), {
			target: { value: "  Draft  " },
		});
		fireEvent.change(
			screen.getByPlaceholderText("Write your content here..."),
			{
				target: { value: "  Body  " },
			},
		);
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith({
				title: "Draft",
				content: "Body",
			});
		});
	});

	it("calls cancel without submitting", () => {
		const onCancel = vi.fn();
		const onSubmit = vi.fn().mockResolvedValue(undefined);

		render(
			<PostForm
				initialValue={{ title: "Draft", content: "Body" }}
				isEditing={false}
				isPending={false}
				onCancel={onCancel}
				onSubmit={onSubmit}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
