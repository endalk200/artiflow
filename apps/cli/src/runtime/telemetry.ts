import { Logger } from "effect";

export const withoutConsoleLogger = Logger.layer([], {
	mergeWithExisting: false,
});
