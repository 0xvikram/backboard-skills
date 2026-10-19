// Runs before tsc. The recipe-5 note shows a bare `customContracts: { ... }` property to add to Safe4337Pack.init's
// options. That fragment can't stand alone, so it is wrapped in an object typed as Safe4337Pack.init's options and
// checked against relay-kit's real type (wrong keys or a misspelt property name fail the type-check).
import { readdirSync, readFileSync, writeFileSync } from "node:fs"

for (const f of readdirSync("blocks")) {
  if (!/\.tsx?$/.test(f)) continue
  const path = `blocks/${f}`, code = readFileSync(path, "utf8")
  if (!/^\s*customContracts\s*:/.test(code)) continue
  writeFileSync(path, `import { Safe4337Pack } from "@safe-global/relay-kit"
type InitOptions = Parameters<typeof Safe4337Pack.init>[0]
export const fragment: Pick<InitOptions, "customContracts"> = {
// ---- block from the skill ----
${code}}
`)
  console.log(`wrapped property fragment ${f}`)
}
