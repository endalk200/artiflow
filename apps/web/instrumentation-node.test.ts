import { logs } from "@opentelemetry/api-logs";
import {
	InMemoryLogRecordExporter,
	LoggerProvider,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { afterEach, describe, expect, it } from "vitest";

import { reportNextRequestError } from "./instrumentation-node";

afterEach(() => {
	logs.disable();
});

describe("Next.js request error telemetry", () => {
	it("emits useful route metadata without raw paths or error messages", async () => {
		const exporter = new InMemoryLogRecordExporter();
		const provider = new LoggerProvider({
			processors: [new SimpleLogRecordProcessor({ exporter })],
		});
		logs.setGlobalLoggerProvider(provider);

		const error = new Error("postgresql://user:password@database/private");
		error.stack = [
			"Error: postgresql://user:password@database/private",
			"    at handleRequest (/srv/artiflow/server.js:10:2)",
		].join("\n");

		reportNextRequestError(
			error,
			{
				headers: {},
				method: "GET",
				path: "/projects/private-project?token=secret",
			} as Parameters<typeof reportNextRequestError>[1],
			{
				renderSource: "react-server-components",
				routePath: "/projects/[projectId]",
				routeType: "render",
				routerKind: "App Router",
			} as Parameters<typeof reportNextRequestError>[2],
		);
		await provider.forceFlush();

		const [record] = exporter.getFinishedLogRecords();
		expect(record?.body).toBe("Unhandled Next.js request error");
		expect(record?.attributes).toMatchObject({
			"error.type": "Error",
			"exception.message": "Unhandled Next.js request error",
			"http.request.method": "GET",
			"next.route": "/projects/[projectId]",
		});
		const serializedRecord = JSON.stringify(record);
		expect(serializedRecord).not.toContain("private-project");
		expect(serializedRecord).not.toContain("token=secret");
		expect(serializedRecord).not.toContain("user:password");

		await provider.shutdown();
	});
});
