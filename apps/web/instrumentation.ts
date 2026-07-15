export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { registerNextOtel } = await import("./observability/otel.node.ts");

		registerNextOtel();
	}
}
