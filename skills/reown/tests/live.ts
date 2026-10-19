// Key-free checks for the reown skill. Run by scripts/verify.mjs after the blocks are written to blocks/.
//   1. Network exports in @reown/appkit/networks match references/chains.md (IDs, and the exports to avoid).
//   2. recipes.md #5 defineChain block at runtime.
//   3. Each sponsor export's default RPC answers the expected eth_chainId (network).
//   4. recipes.md #7 `verify()` block: a throwaway key made at runtime signs a message; the block verifies it on
//      Sepolia's public RPC (valid -> true, tampered -> false) (network).
//   5. The Reown docs MCP server in mcp.md answers `initialize` as "Reown Docs" (network).
// Exit 0 = pass, 1 = real failure, 75 = a public service could not be reached.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPublicClient, http, type Chain} from 'viem';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';
import * as networks from '@reown/appkit/networks';

const BLOCKS = join(import.meta.dirname, 'blocks');
let failed = 0, network = 0;
const ok = (cond: boolean, label: string, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? ` (${extra})` : ''}`);
  if (!cond) failed++;
};
const unreachable = (what: string, e: unknown) => { network++; console.log(`~    ${what} unreachable: ${(e as Error).message.split('\n')[0]}`); };
/** The block whose source contains every needle, so renumbering the skill's blocks doesn't break the test. */
const block = (...needles: string[]) => {
  const f = readdirSync(BLOCKS).find((n) => needles.every((s) => readFileSync(join(BLOCKS, n), 'utf8').includes(s)));
  if (!f) throw new Error(`no code block in the skill contains ${needles.join(' + ')}`);
  return pathToFileURL(join(BLOCKS, f)).href;
};

// 1. Exports (chains.md)
const n = networks as unknown as Record<string, Chain>;
const sponsor: [string, number][] = [
  ['worldchainSepolia', 4801], ['worldchain', 480], ['unichainSepolia', 1301], ['unichain', 130],
  ['hederaTestnet', 296], ['hedera', 295], ['arcTestnet', 5042002], ['arc', 5042],
  ['zeroGTestnet', 16602], ['zeroGMainnet', 16661], ['whitechainSepolia', 1874], ['whitechain', 1875]
];
const avoid: [string, number][] = [['zeroG', 16600], ['zeroGGalileoTestnet', 16601], ['whitechainTestnet', 2625]];
for (const [name, id] of [...sponsor, ...avoid]) ok(n[name]?.id === id, `@reown/appkit/networks ${name} is ${id}`, String(n[name]?.id));

// 2. defineChain (recipes.md #5)
const {myChain} = await import(block('defineChain', 'export const myChain'));
ok(myChain.id === 123456789 && myChain.caipNetworkId === 'eip155:123456789' && myChain.chainNamespace === 'eip155', 'defineChain block returns an AppKit network', `${myChain.id} ${myChain.caipNetworkId}`);
if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }

// 3. Default RPCs of the sponsor exports
for (const [name, id] of sponsor) {
  try {
    const got = await createPublicClient({chain: n[name], transport: http(undefined, {timeout: 15_000, retryCount: 2})}).getChainId();
    ok(got === id, `${name} default RPC reports chainId ${id}`, String(got));
  } catch (e) { unreachable(`${name} RPC`, e); }
}

// 4. Server-side signature check (recipes.md #7)
const {verify} = await import(block('export async function verify', 'verifyMessage'));
const account = privateKeyToAccount(generatePrivateKey());
const message = `backboard verify nonce ${Date.now()}`;
const signature = await account.signMessage({message});
try {
  ok(await verify(account.address, message, signature) === true, 'verify(): valid signature -> true');
  ok(await verify(account.address, `${message}!`, signature) === false, 'verify(): tampered message -> false');
} catch (e) { unreachable('Sepolia public RPC', e); }

// 5. Docs MCP (mcp.md)
try {
  const res = await fetch('https://docs.reown.com/mcp', {
    method: 'POST',
    headers: {'content-type': 'application/json', accept: 'application/json, text/event-stream'},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'backboard-verify', version: '1'}}}),
    signal: AbortSignal.timeout(20_000)
  });
  if (res.status >= 500 || res.status === 429) unreachable('docs.reown.com/mcp', new Error(`HTTP ${res.status}`));
  else {
    const text = await res.text();
    ok(res.ok && /"serverInfo"/.test(text) && /Reown Docs/i.test(text), 'docs.reown.com/mcp answers initialize as "Reown Docs"', `HTTP ${res.status} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
  }
} catch (e) { unreachable('docs.reown.com/mcp', e); }

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
if (network) process.exit(75);
console.log('\nall reown live checks passed');
process.exit(0); // don't wait for idle keep-alive sockets
