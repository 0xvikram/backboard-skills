// Builds the Next.js app the skill describes, from the skill's own code blocks (written to blocks/ by verify.mjs):
//   /          quickstart.md: providers.tsx, layout.tsx, page.tsx (in the (main) route group)
//   /recipes   recipes.md #1-#5, #7, #8 components under the recipe's Privy + wagmi providers
//   /api/me    recipes.md #6 route handler
// Then runs `next build` (Turbopack) with a fake 25-character app ID (the SDK rejects shorter IDs at prerender).
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const here = import.meta.dirname, blocks = join(here, 'blocks'), app = join(here, 'app');
const files = readdirSync(blocks).map((n) => ({n, src: readFileSync(join(blocks, n), 'utf8')}));
const pick = (prefix, ...needles) => {
  const hit = files.filter((f) => f.n.startsWith(prefix) && needles.every((s) => f.src.includes(s)));
  if (hit.length !== 1) throw new Error(`expected one ${prefix}* block with ${needles.join(' + ')}, found ${hit.length}`);
  return hit[0].src;
};
const put = (rel, src) => { mkdirSync(join(app, rel, '..'), {recursive: true}); writeFileSync(join(app, rel), src); };

rmSync(app, {recursive: true, force: true});
cpSync(join(here, 'app-template'), app, {recursive: true});
put('(main)/providers.tsx', pick('quickstart-', 'export default function Providers'));
put('(main)/layout.tsx', pick('quickstart-', 'export default function RootLayout'));
put('(main)/page.tsx', pick('quickstart-', 'export default function Home'));
put('api/me/route.ts', pick('recipes-', 'export async function GET'));
const r = '(recipes)/recipes/';
put(`${r}providers.tsx`, pick('recipes-', "from '@privy-io/wagmi'"));
put(`${r}_blocks/email.tsx`, pick('recipes-', 'export function EmailLogin'));
put(`${r}_blocks/google.tsx`, pick('recipes-', 'export function GoogleLogin'));
put(`${r}_blocks/send-token.tsx`, pick('recipes-', 'export function SendToken'));
put(`${r}_blocks/viem.tsx`, pick('recipes-', 'export function SendWithViem'));
put(`${r}_blocks/counter.tsx`, pick('recipes-', 'export function Counter'));
put(`${r}_blocks/call-api.tsx`, pick('recipes-', 'export function CallApi'));
put(`${r}_blocks/world.tsx`, pick('recipes-', 'export function WorldLogin'));
if (!existsSync(join(here, 'next.config.mjs'))) writeFileSync(join(here, 'next.config.mjs'), 'export default {};\n');

const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_PRIVY_APP_ID: 'cltestappid0000000000000a', // 25 chars, not a real app
  PRIVY_APP_ID: 'cltestappid0000000000000a',
  PRIVY_APP_SECRET: 'not-a-real-secret'
};
const res = spawnSync(process.execPath, [join(here, 'node_modules/next/dist/bin/next'), 'build'], {cwd: here, env, stdio: 'inherit'});
process.exit(res.status ?? 1);
