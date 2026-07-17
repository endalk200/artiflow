import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";

import { e2ePort } from "./config";

const e2eEnvironment = {
	...process.env,
	ARTIFLOW_NEXT_DIST_DIR: ".next-e2e",
};

let activeChild: ChildProcess | undefined;
let interrupted = false;

const stopActiveChild = () => {
	interrupted = true;
	activeChild?.kill("SIGTERM");
};

process.once("SIGINT", stopActiveChild);
process.once("SIGTERM", stopActiveChild);

const run = async (args: ReadonlyArray<string>) => {
	const child = spawn("bun", [...args], {
		env: e2eEnvironment,
		stdio: "inherit",
	});
	activeChild = child;

	try {
		const [code] = (await once(child, "exit")) as [number | null];
		return code;
	} finally {
		if (activeChild === child) activeChild = undefined;
	}
};

try {
	const buildCode = await run(["run", "build"]);

	if (interrupted) {
		process.exitCode = 0;
	} else if (buildCode !== 0) {
		throw new Error(
			`E2E production build exited with code ${buildCode ?? "unknown"}.`,
		);
	} else {
		const serverCode = await run(["run", "start", "--port", String(e2ePort)]);
		process.exitCode = interrupted ? 0 : (serverCode ?? 1);
	}
} finally {
	process.off("SIGINT", stopActiveChild);
	process.off("SIGTERM", stopActiveChild);
	activeChild?.kill("SIGTERM");
}
