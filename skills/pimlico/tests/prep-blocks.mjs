// Runs before tsc. Some recipe blocks are fragments that continue the setup block (they use `smartAccountClient`,
// `pimlicoClient`, ... without creating them). For those, prepend prelude.ts so they type-check as the user would
// paste them: below the setup. A fragment that creates its own `smartAccountClient` gets the prelude without that part.
import { readdirSync, readFileSync, writeFileSync } from "node:fs"

const prelude = readFileSync("prelude.ts", "utf8")
const withoutClient = prelude.replace(/\/\/ @smartAccountClient[\s\S]*?\/\/ @end\n/, "")
for (const f of readdirSync("blocks")) {
  if (!/\.tsx?$/.test(f)) continue
  const path = `blocks/${f}`, code = readFileSync(path, "utf8")
  const standalone = /from\s+["']permissionless/.test(code)
  const usesSetup = /\b(smartAccountClient|pimlicoClient)\b/.test(code)
  if (standalone || !usesSetup) continue
  const declaresClient = /\bconst\s+smartAccountClient\b/.test(code)
  writeFileSync(path, `${declaresClient ? withoutClient : prelude}\n// ---- block from the skill ----\n${code}`)
  console.log(`prelude added to ${f}`)
}
