// Read-only live checks for the namespace skill: no API key, no wallet, no transactions.
// Exit 75 = network problem, 1 = real failure. Runs after `typecheck` (prep.mjs adds blocks/namespace.ts etc.).
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createOffchainClient } from '@thenamespace/offchain-manager';
import { createMintClient, MintManagerError, normalizeName } from '@thenamespace/mint-manager';

const NETWORK = 75;
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { failed++; console.error(`  ✗ ${m}`); };
const note = (m: string) => console.log(`  • ${m}`);
const NET_RE = /fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|timeout of \d+ms exceeded|HTTP request failed|Status: (429|5\d\d)|status code (429|5\d\d)/i;
const net = (e: unknown): never => { console.error(`network: ${String((e as Error)?.message ?? e).slice(0, 300)}`); process.exit(NETWORK); };
const guard = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
  try { return await fn(); } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    if (NET_RE.test(String((e as Error)?.message)) || (status !== undefined && (status >= 500 || status === 429))) net(e);
    bad(`${label}: threw ${String((e as Error)?.message).slice(0, 200)}`); return undefined;
  }
};

const blocks = readdirSync('blocks').filter((f) => /\.tsx?$/.test(f)).sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, 'utf8') }));
const block = (desc: string, test: (c: string) => boolean) => {
  const b = blocks.find((x) => !['namespace.ts', 'mint-clients.ts'].includes(x.f) && test(x.code));
  if (!b) bad(`no block found for ${desc}`);
  return b;
};
const runBlock = (f: string, args: string[] = [], env: Record<string, string | undefined> = {}) => {
  const e: Record<string, string | undefined> = { ...process.env, ...env };
  for (const k of ['NAMESPACE_API_KEY', 'PARENT_NAME', 'WALLET_PRIVATE_KEY', 'BASE_SEPOLIA_RPC_URL']) if (!(k in env)) delete e[k];
  const r = spawnSync(process.execPath, ['node_modules/.bin/tsx', `blocks/${f}`, ...args], { encoding: 'utf8', timeout: 90_000, env: e as NodeJS.ProcessEnv });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

// --- Offchain Manager (mainnet API, reads need no key)
console.log('Offchain Manager 1.0.13 reads (mainnet, no key)');
const off = createOffchainClient({ mode: 'mainnet', timeout: 20_000 });
const taken = await guard('isSubnameAvailable(taken)', () => off.isSubnameAvailable('test.artii.eth'));
const free = await guard('isSubnameAvailable(free)', () => off.isSubnameAvailable(`zz-backboard-${Date.now()}.artii.eth`));
if (taken && free) taken.isAvailable === false && free.isAvailable === true ? ok('isSubnameAvailable: test.artii.eth taken, random label free') : bad(`isSubnameAvailable: taken=${JSON.stringify(taken)} free=${JSON.stringify(free)}`);
const page = await guard('getFilteredSubnames', () => off.getFilteredSubnames({ parentName: 'artii.eth', page: 1, size: 3 }));
if (page) page.totalItems > 0 && Array.isArray(page.items) && page.items.every((s) => s.fullName.endsWith('.artii.eth')) ? ok(`getFilteredSubnames(artii.eth): totalItems ${page.totalItems}, e.g. ${page.items[0]?.fullName}`) : bad(`getFilteredSubnames: ${JSON.stringify(page).slice(0, 200)}`);
const single = await guard('getSingleSubname', () => off.getSingleSubname('test.artii.eth'));
if (single) single.fullName === 'test.artii.eth' ? ok('getSingleSubname(test.artii.eth): found') : bad(`getSingleSubname: ${JSON.stringify(single).slice(0, 200)}`);
try {
  const missing = await off.getSingleSubname(`zz-missing-${Date.now()}.artii.eth`);
  bad(`getSingleSubname(missing) returned ${JSON.stringify(missing)} instead of throwing: errors.md #5 and recipes.md's try/catch may be stale`);
} catch (e) {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status !== 404 && NET_RE.test(String((e as Error)?.message))) net(e);
  status === 404 ? ok('getSingleSubname(missing): throws a 404 (errors.md #5)') : bad(`getSingleSubname(missing): threw status ${status}: ${(e as Error).message}`);
}

// --- Mint Manager
console.log('Mint Manager 2.0.0 checkName (Optimism listing oppunk.eth, no wallet)');
ok(`normalizeName('Alice.OPPUNK.eth') = ${normalizeName('Alice.OPPUNK.eth')}`);
if (normalizeName('Alice.OPPUNK.eth') !== 'alice.oppunk.eth') bad('normalizeName did not lowercase');
const mint = createMintClient({ mintSource: 'backboard-verify', customRpcUrls: { 10: 'https://mainnet.optimism.io' } });
const minter = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const;
const fresh = await guard('checkName(fresh)', () => mint.checkName(`zzbackboard${Date.now()}.oppunk.eth`, { minterAddress: minter, rpc: 'always' }));
if (fresh) fresh.status === 'available' && fresh.chainId === 10 ? ok(`fresh label: available, L2 listing on chain ${fresh.chainId}`) : bad(`fresh label: ${JSON.stringify(fresh).slice(0, 300)}`);
const lucasAlways = await guard("checkName(lucas, rpc: 'always')", () => mint.checkName('lucas.oppunk.eth', { minterAddress: minter, rpc: 'always' }));
if (lucasAlways) lucasAlways.status !== 'available' ? ok(`minted name with rpc: 'always': ${lucasAlways.status} (recipe 4 / errors.md #7 advice)`) : bad("lucas.oppunk.eth with rpc: 'always' says available: the minted test name may have expired, or the advice no longer holds");
const lucasAuto = await guard('checkName(lucas, default rpc)', () => mint.checkName('lucas.oppunk.eth', { minterAddress: minter }));
if (lucasAuto) note(`same name with the default rpc: 'auto': ${lucasAuto.status}${lucasAuto.status === 'available' ? ' (errors.md #7 false "available" still happens)' : ' (errors.md #7 no longer reproduces: consider updating it)'}`);
try {
  await mint.checkName('nolisting-zz-backboard.eth', { minterAddress: minter });
  bad('unlisted parent: checkName did not throw');
} catch (e) {
  if (e instanceof MintManagerError) e.code === 'LISTING_NOT_FOUND' ? ok('unlisted parent: MintManagerError LISTING_NOT_FOUND') : bad(`unlisted parent: MintManagerError ${e.code}`);
  else { if (NET_RE.test(String((e as Error)?.message))) net(e); bad(`unlisted parent: ${(e as Error).message}`); }
}

// --- Skill blocks, run for real
console.log('Skill blocks run for real');
const runChecked = (desc: string, test: (c: string) => boolean, args: string[], expect: (out: string) => boolean, what: string) => {
  const b = block(desc, test);
  if (!b) return;
  const r = runBlock(b.f, args);
  if (r.code !== 0 && NET_RE.test(r.out)) net(r.out);
  r.code === 0 && expect(r.out) ? ok(`${b.f} (${desc}${args.length ? ` ${args.join(' ')}` : ''}): ${what}`) : bad(`${b.f} (${desc}): exit ${r.code}: ${r.out.slice(-500)}`);
};
runChecked('indexer', (c) => c.includes('createIndexerClient'), [], (o) => o.includes('lucas.oppunk.eth') && /0x[0-9a-fA-F]{40}/.test(o) && /avatar/.test(o), 'L2 subname, registry and list on Optimism');
runChecked('viem ENS', (c) => c.includes("from 'viem/ens'") && c.includes('getEnsAvatar'), ['nick.eth'], (o) => /address: '0x[0-9a-fA-F]{40}'/.test(o) && o.includes("primary: 'nick.eth'"), 'address, avatar, url and primary name');
runChecked('viem ENS', (c) => c.includes("from 'viem/ens'") && c.includes('getEnsAvatar'), ['lucas.oppunk.eth'], (o) => /address: '0x86f012BC12B986FcF58AD672f03817cD210528ed'/i.test(o) && /avatar: 'https:/.test(o), 'Namespace L2 subname resolved through CCIP Read');
runChecked('Resolvio', (c) => c.includes('api.resolvio.xyz'), ['nick.eth'], (o) => /eth: '0x[0-9a-fA-F]{40}'/.test(o), 'profile with eth address');
runChecked('sepolia reads', (c) => c.includes("createOffchainClient({ mode: 'sepolia' }); // reads need no API key"), [], (o) => /^\d+ \[/m.test(o), 'getFilteredSubnames + getSingleSubname on the sepolia API');

// Blocks that need keys must stop at their env guard (this also proves the CJS SDKs load as named ESM imports).
console.log('Key-needing blocks stop at their env guard');
for (const [desc, test, msg] of [
  ['offchain quickstart', (c: string) => c.includes("from './namespace.js'") && c.includes('createSubname'), 'Missing NAMESPACE_API_KEY'],
  ['onchain mint', (c: string) => c.includes("from './mint-clients.js'"), 'Missing BASE_SEPOLIA_RPC_URL'],
] as const) {
  const b = block(desc, test);
  if (!b) continue;
  const r = runBlock(b.f);
  r.code !== 0 && r.out.includes(msg) ? ok(`${b.f} (${desc}): "${msg}"`) : bad(`${b.f} (${desc}): expected "${msg}", got exit ${r.code}: ${r.out.slice(-300)}`);
}

if (failed) { console.error(`${failed} live check(s) failed`); process.exit(1); }
console.log('live: all checks passed');
process.exit(0);
