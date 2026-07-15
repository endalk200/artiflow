export function callbackFrom(value: string | undefined) {
	if (!value?.startsWith("/") || value.startsWith("//")) {
		return "/";
	}

	return value;
}
