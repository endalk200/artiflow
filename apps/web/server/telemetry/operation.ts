import { Effect } from "effect";

export type OperationOutcome =
	| "conflict"
	| "created"
	| "deleted"
	| "not_found"
	| "renamed"
	| "replayed";

type OperationTelemetryAttributes = Readonly<
	Record<string, boolean | number | string> & {
		readonly "artiflow.operation.outcome": OperationOutcome;
	}
>;

const recordOperation = (
	log: Effect.Effect<void>,
	attributes: OperationTelemetryAttributes,
) =>
	Effect.annotateCurrentSpan(attributes).pipe(
		Effect.andThen(log.pipe(Effect.annotateLogs(attributes))),
	);

export const recordOperationInfo = (
	message: string,
	attributes: OperationTelemetryAttributes,
) => recordOperation(Effect.logInfo(message), attributes);

export const recordOperationWarning = (
	message: string,
	attributes: OperationTelemetryAttributes,
) => recordOperation(Effect.logWarning(message), attributes);
