import { readFile, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const validationDirectory = dirname(fileURLToPath(import.meta.url))
const skillDirectory = join(validationDirectory, "..")
const referencesDirectory = join(skillDirectory, "references")
const referenceFiles = (await readdir(referencesDirectory))
  .filter((file) => file.endsWith(".md"))
  .map((file) => join(referencesDirectory, file))
const files = [join(skillDirectory, "SKILL.md"), ...referenceFiles]

const forbidden = [
  {
    pattern: /Schema\.asClass/g,
    replacement: "direct schema subclassing",
  },
  {
    pattern: /Schedule\.tapInput/g,
    replacement: "Schedule.tap(({ input }) => ...)",
  },
  {
    pattern: /@effect-atom\//g,
    replacement: "effect/unstable/reactivity or @effect/atom-* adapters",
  },
  {
    pattern: /(?<!Async)\bResult\.(?:builder|map)\b/g,
    replacement: "AsyncResult",
  },
  {
    pattern: /\b(?:AtomHttpApi|AtomRpc)\.(?:query|mutation)\b/g,
    replacement: "query or mutation on the service client",
  },
]

const violations = []

for (const file of files) {
  const source = await readFile(file, "utf8")
  for (const rule of forbidden) {
    for (const match of source.matchAll(rule.pattern)) {
      const line = source.slice(0, match.index).split("\n").length
      violations.push(
        `${file}:${line}: ${JSON.stringify(match[0])} was removed; use ${rule.replacement}`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"))
  process.exitCode = 1
} else {
  console.log(`Checked ${files.length} skill documents for removed Effect APIs.`)
}
