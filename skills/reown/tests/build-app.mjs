// Builds the apps the skill describes, from the skill's own code blocks (written to blocks/ by verify.mjs):
//   app/next   recipes.md #2 Next.js App Router project (next.config.ts, config/index.ts, context/index.tsx,
//              app/layout.tsx, app/page.tsx) plus /wallet rendering recipes #1, #3, #6, #8. `next build` twice:
//              with the recipe's next.config.ts as written, then with `cacheComponents: true, partialPrefetching: true`
//              added (what create-next-app 16.4 turns on; the recipe's layout wraps Providers in <Suspense> for it).
//   app/vite   quickstart.md src/config.ts, src/main.tsx, src/App.tsx in a create-vite react-ts layout; `vite build`.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const here = import.meta.dirname, blocks = join(here, 'blocks'), app = join(here, 'app')
const files = readdirSync(blocks).map((n) => ({ n, src: readFileSync(join(blocks, n), 'utf8') }))
const pick = (prefix, ...needles) => {
  const hit = files.filter((f) => f.n.startsWith(prefix) && needles.every((s) => f.src.includes(s)))
  if (hit.length !== 1) throw new Error(`expected one ${prefix}* block with ${needles.join(' + ')}, found ${hit.length}`)
  return hit[0].src
}
const put = (rel, src) => { mkdirSync(join(app, rel, '..'), { recursive: true }); writeFileSync(join(app, rel), src) }
const run = (label, argv, cwd, env) => {
  console.log(`\n== ${label}`)
  const r = spawnSync(process.execPath, argv, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

rmSync(app, { recursive: true, force: true })
cpSync(join(here, 'app-template'), app, { recursive: true })

const nextConfig = pick('recipes-', 'const nextConfig: NextConfig', 'export default nextConfig')
put('next/next.config.ts', nextConfig)
put('next/config/index.ts', pick('recipes-', 'cookieStorage', 'export const wagmiAdapter'))
put('next/context/index.tsx', pick('recipes-', 'export default function ContextProvider'))
put('next/app/layout.tsx', pick('recipes-', 'export default function RootLayout'))
put('next/app/page.tsx', pick('recipes-', "'use client'", 'export default function Home'))
put('next/components/wallet.tsx', pick('recipes-', 'export default function Wallet'))
put('next/components/buttons.tsx', pick('recipes-', 'export function Buttons'))
put('next/components/embedded-info.tsx', pick('recipes-', 'export function EmbeddedInfo'))
put('next/components/contract.tsx', pick('recipes-', 'export function Contract'))

put('vite/src/config.ts', pick('quickstart-', 'export const wagmiAdapter'))
put('vite/src/main.tsx', pick('quickstart-', 'createAppKit', 'createRoot'))
put('vite/src/App.tsx', pick('quickstart-', 'export default function App'))

const next = [join(here, 'node_modules/next/dist/bin/next'), 'build']
const nextEnv = { NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_PROJECT_ID: '00000000000000000000000000000000' }
run('next build (recipe next.config.ts)', next, join(app, 'next'), nextEnv)
const marker = "serverExternalPackages: ['@coinbase/cdp-sdk'],"
if (!nextConfig.includes(marker)) throw new Error('recipe next.config.ts no longer has the serverExternalPackages line')
put('next/next.config.ts', nextConfig.replace(marker, `${marker}\n  cacheComponents: true,\n  partialPrefetching: true,`))
rmSync(join(app, 'next/.next'), { recursive: true, force: true })
run('next build (with cacheComponents + partialPrefetching)', next, join(app, 'next'), nextEnv)
run('vite build (quickstart)', [join(here, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'], join(app, 'vite'), { VITE_PROJECT_ID: '00000000000000000000000000000000' })
