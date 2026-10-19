// Builds the Vite + React apps the skill describes, from the skill's own code blocks (written to blocks/ by verify.mjs),
// with `vite build` (Vite 5, as the skill says):
//   app/quickstart  quickstart.md: vite.config.ts, src/main.tsx, src/App.tsx, exactly as written
//   app/recipes     index.html = recipes.md #6 main.tsx with custom networks, rendering recipes #1-#4 and #7 (client)
//                   wagmi.html = recipes.md #5 wagmi App; mint.html = recipes.md #5 MintButton under the #6 wagmi config
// The recipes app uses the skill's vite.config.ts with the HTML entry merged in, one build per entry.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = import.meta.dirname, blocks = join(here, 'blocks'), app = join(here, 'app');
const files = readdirSync(blocks).map((n) => ({ n, src: readFileSync(join(blocks, n), 'utf8') }));
const pick = (prefix, ...needles) => {
  const hit = files.filter((f) => f.n.startsWith(prefix) && needles.every((s) => f.src.includes(s)));
  if (hit.length !== 1) throw new Error(`expected one ${prefix}* block with ${needles.join(' + ')}, found ${hit.length}`);
  return hit[0].src;
};
const put = (rel, src) => { mkdirSync(join(app, rel, '..'), { recursive: true }); writeFileSync(join(app, rel), src); };

rmSync(app, { recursive: true, force: true });
cpSync(join(here, 'app-template'), app, { recursive: true });
const viteConfig = pick('quickstart-', "from 'vite'", 'defineConfig');
put('quickstart/vite.config.ts', viteConfig);
put('quickstart/src/main.tsx', pick('quickstart-', 'createRoot', 'DynamicContextProvider'));
put('quickstart/src/App.tsx', pick('quickstart-', 'export default function App'));

put('recipes/vite.skill.config.ts', viteConfig);
put('recipes/src/main.tsx', pick('recipes-', 'createRoot', 'mergeNetworks'));
put('recipes/src/networks.ts', pick('recipes-', 'export function toEvmNetwork'));
put('recipes/src/wagmi.ts', pick('recipes-', 'getOrMapViemChain'));
put('recipes/src/WagmiApp.tsx', pick('recipes-', 'DynamicWagmiConnector', 'export default function App'));
put('recipes/src/recipes/header.tsx', pick('recipes-', 'export function Header'));
put('recipes/src/recipes/embedded.tsx', pick('recipes-', 'export function CreateEmbeddedWallet'));
put('recipes/src/recipes/send.tsx', pick('recipes-', 'export function SendTransaction'));
put('recipes/src/recipes/sign.tsx', pick('recipes-', 'export function SignMessageButton'));
put('recipes/src/recipes/api.ts', pick('recipes-', 'export async function callMyApi'));
put('recipes/src/recipes/mint.tsx', pick('recipes-', 'export function MintButton'));

const env = { ...process.env, VITE_DYNAMIC_ENVIRONMENT_ID: '00000000-0000-0000-0000-000000000000' };
for (const [dir, entry] of [['quickstart'], ['recipes', 'index'], ['recipes', 'wagmi'], ['recipes', 'mint']]) {
  console.log(`\n== vite build app/${dir}${entry ? ` (${entry}.html)` : ''}`);
  const r = spawnSync(process.execPath, [join(here, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'], { cwd: join(app, dir), env: { ...env, ENTRY: entry }, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
