import { type ConfigValidationReport, validateArtiflowConfig } from "../../../config/index.js";
import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { ConfigValidationFailed } from "../../../runtime/failures.js";

export const formatConfigValidationReport = (report: ConfigValidationReport): ReadonlyArray<string> => [
	report.file.message,
	report.env.message,
	report.effective.message,
];

export const configValidationHasFailures = (report: ConfigValidationReport): boolean =>
	[report.file, report.env, report.effective].some((status) => status._tag === "invalid");

export const validateCommand = Command.make("validate").pipe(
	Command.withDescription("Validate Artiflow Configuration sources"),
	Command.withShortDescription("Validate config"),
	Command.withHandler(() =>
		Effect.gen(function* () {
			const report = yield* validateArtiflowConfig;
			const hasFailures = configValidationHasFailures(report);

			const validationLogAttributes = {
				"artiflow.config.path": report.path.path,
				"artiflow.config.path_source": report.path.source,
				"artiflow.config.valid": !hasFailures,
				"artiflow.config.file_validation_status": report.file._tag,
				"artiflow.config.env_validation_status": report.env._tag,
				"artiflow.config.effective_validation_status": report.effective._tag,
			};

			if (hasFailures) {
				yield* Effect.logWarning("Artiflow Configuration validation failed", validationLogAttributes);
			} else {
				yield* Effect.logInfo("Validated Artiflow Configuration", validationLogAttributes);
			}

			for (const line of formatConfigValidationReport(report)) {
				yield* Console.log(line);
			}

			if (hasFailures) {
				return yield* Effect.fail(new ConfigValidationFailed());
			}
		}).pipe(
			Effect.withSpan("artiflow.cli.config.validate", {
				attributes: {
					"cli.command": "config validate",
					"artiflow.command": "config validate",
				},
			}),
			Effect.annotateLogs({
				"artiflow.command": "config validate",
			}),
		),
	),
);
