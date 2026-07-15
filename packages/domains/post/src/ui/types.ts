export type PostListPost = {
	id: string;
	title: string;
	content: string;
};

export type PostFormValue = {
	title: string;
	content: string;
};

export type PostListScreen = "list" | "create" | "edit" | "view";

export const initialPostFormValue: PostFormValue = {
	title: "",
	content: "",
};
