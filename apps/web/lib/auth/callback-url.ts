const CALLBACK_BASE = "https://callback.invalid";

function hasControlCharacter(value: string): boolean {
	return Array.from(value).some((character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || code === 127;
	});
}

export function safeCallbackURL(
	value: string | string[] | undefined,
	fallback = "/projects",
): string {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		value.startsWith("//")
	) {
		return fallback;
	}

	try {
		const callback = new URL(value, CALLBACK_BASE);
		const decodedPath = decodeURIComponent(callback.pathname);
		if (
			callback.origin !== CALLBACK_BASE ||
			callback.username ||
			callback.password ||
			decodedPath.startsWith("//") ||
			decodedPath.includes("\\") ||
			hasControlCharacter(decodedPath)
		) {
			return fallback;
		}
		return `${callback.pathname}${callback.search}${callback.hash}`;
	} catch {
		return fallback;
	}
}
