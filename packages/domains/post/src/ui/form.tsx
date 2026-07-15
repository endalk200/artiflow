import { useForm } from "@tanstack/react-form";
import { Button } from "@app/ui/components/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@app/ui/components/field";
import { Input } from "@app/ui/components/input";
import { Textarea } from "@app/ui/components/textarea";
import { Schema } from "effect";
import type { PostFormValue } from "./types.ts";

const requiredString = (message: string) =>
	Schema.toStandardSchemaV1(
		Schema.String.check(
			Schema.makeFilter((value) => value.trim().length > 0 || message),
		),
	);

const postFormSchema = Schema.toStandardSchemaV1(
	Schema.Struct({
		title: requiredString("Title is required."),
		content: requiredString("Content is required."),
	}),
);

const titleSchema = requiredString("Title is required.");
const contentSchema = requiredString("Content is required.");

export function PostForm({
	initialValue,
	isEditing,
	isPending,
	onCancel,
	onSubmit,
}: {
	initialValue: PostFormValue;
	isEditing: boolean;
	isPending: boolean;
	onCancel: () => void;
	onSubmit: (value: PostFormValue) => Promise<unknown>;
}) {
	const form = useForm({
		defaultValues: initialValue,
		validators: {
			onSubmit: postFormSchema,
		},
		onSubmit: async ({ value }) => {
			await onSubmit({
				title: value.title.trim(),
				content: value.content.trim(),
			});
		},
	});

	return (
		<form
			className="min-h-[520px] px-7 py-9"
			data-testid="post-form"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<h2 className="mb-8 text-2xl font-semibold tracking-normal">
				{isEditing ? "Edit Post" : "Create Post"}
			</h2>

			<FieldGroup>
				<form.Field
					name="title"
					validators={{
						onBlur: titleSchema,
					}}
				>
					{(field) => {
						const errors = field.state.meta.isTouched
							? field.state.meta.errors
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Title</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									placeholder="Enter title"
									aria-invalid={isInvalid}
									data-testid="post-form-title-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>

				<form.Field
					name="content"
					validators={{
						onBlur: contentSchema,
					}}
				>
					{(field) => {
						const errors = field.state.meta.isTouched
							? field.state.meta.errors
							: [];
						const isInvalid = errors.length > 0;

						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Content</FieldLabel>
								<Textarea
									id={field.name}
									name={field.name}
									className="min-h-48 resize-none"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									placeholder="Write your content here..."
									aria-invalid={isInvalid}
									data-testid="post-form-content-input"
								/>
								<FieldError errors={errors} />
							</Field>
						);
					}}
				</form.Field>
			</FieldGroup>

			<div className="mt-9 flex justify-end gap-4">
				<Button
					type="button"
					variant="outline"
					size="lg"
					className="min-w-28"
					data-testid="post-form-cancel-button"
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					size="lg"
					className="min-w-28"
					disabled={isPending}
					data-testid="post-form-save-button"
				>
					Save
				</Button>
			</div>
		</form>
	);
}
