import type { Instrumentation } from "next";

export const register = async () => {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { registerNodeInstrumentation } = await import(
			"./instrumentation-node"
		);
		registerNodeInstrumentation();
	}
};

export const onRequestError: Instrumentation.onRequestError = async (
	error,
	request,
	context,
) => {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { reportNextRequestError } = await import("./instrumentation-node");
		reportNextRequestError(error, request, context);
	}
};
