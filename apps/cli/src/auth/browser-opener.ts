import { spawn } from "node:child_process";
import { Context, Effect, Layer } from "effect";

export type BrowserOpenerShape = {
	readonly open: (url: string) => Effect.Effect<boolean>;
};

const platformCommand = (url: string): { readonly args: ReadonlyArray<string>; readonly command: string } => {
	if (process.platform === "darwin") return { args: [url], command: "open" };
	if (process.platform === "win32") {
		return { args: ["/d", "/s", "/c", "start", "", url], command: "cmd" };
	}
	return { args: [url], command: "xdg-open" };
};

export const systemBrowserOpener: BrowserOpenerShape = {
	open: (url) =>
		Effect.promise(
			() =>
				new Promise<boolean>((resolve) => {
					const { args, command } = platformCommand(url);
					const child = spawn(command, [...args], {
						detached: true,
						stdio: "ignore",
					});
					child.once("error", () => resolve(false));
					child.once("spawn", () => {
						child.unref();
						resolve(true);
					});
				}),
		),
};

export class BrowserOpener extends Context.Service<BrowserOpener, BrowserOpenerShape>()("BrowserOpener") {
	static readonly layer = Layer.succeed(BrowserOpener, systemBrowserOpener);
}
