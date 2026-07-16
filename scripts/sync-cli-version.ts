import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDirectory, "..");
const cliRoot = join(repoRoot, "apps", "cli");
const versionModulePath = join(cliRoot, "src", "version.generated.ts");
const packageJsonPath = join(cliRoot, "package.json");
const packageJson = (await Bun.file(packageJsonPath).json()) as { readonly version: string };

await writeFile(versionModulePath, `export const VERSION = ${JSON.stringify(packageJson.version)} as const;\n`);
