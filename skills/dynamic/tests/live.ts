// Key-free checks for the dynamic skill. Run by scripts/verify.mjs after the blocks are written to blocks/.
//   1. recipes.md #7 server JWT check (the real block): a local JWKS server on 127.0.0.1 with RSA keys made at runtime.
//      The only change to the block is its jwksUri string, pointed at the local server.
//   2. recipes.md #6 networks block: EvmNetwork objects and Dynamic's getOrMapViemChain mapping (recipes.md #6 wagmi).
//   3. Chain IDs in references/chains.md against viem, then eth_chainId on each public RPC (network).
//   4. The Dynamic JWKS host and path answer (network).
// Exit 0 = pass, 1 = real failure, 75 = a public service could not be reached.
import {mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {generateKeyPairSync} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import jwt from 'jsonwebtoken';
import {createPublicClient, http, type Chain} from 'viem';
import * as viemChains from 'viem/chains';
import {getOrMapViemChain} from '@dynamic-labs/ethereum-core';

const HERE = import.meta.dirname, BLOCKS = join(HERE, 'blocks');
let failed = 0;
const ok = (cond: boolean, label: string, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? ` (${extra})` : ''}`);
  if (!cond) failed++;
};
/** The block whose source contains every needle, so renumbering the skill's blocks doesn't break the test. */
const blockFile = (...needles: string[]) => {
  const f = readdirSync(BLOCKS).find((n) => needles.every((s) => readFileSync(join(BLOCKS, n), 'utf8').includes(s)));
  if (!f) throw new Error(`no code block in the skill contains ${needles.join(' + ')}`);
  return join(BLOCKS, f);
};

// 1. JWT verification (recipes.md #7)
const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const other = generateKeyPairSync('rsa', {modulusLength: 2048});
const kid = 'test-kid';
const jwk = {...publicKey.export({format: 'jwk'}), kid, use: 'sig', alg: 'RS256'};
const server = createServer((_, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({keys: [jwk]})); });
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const local = `http://127.0.0.1:${(server.address() as AddressInfo).port}/jwks`;
const JWKS_TEMPLATE = 'https://app.dynamicauth.com/api/v0/sdk/${ENV_ID}/.well-known/jwks';
const src = readFileSync(blockFile('export async function verifyDynamicJwt'), 'utf8');
ok(src.includes(JWKS_TEMPLATE), 'recipe uses the documented JWKS URL');
mkdirSync(join(HERE, 'run'), {recursive: true});
writeFileSync(join(HERE, 'run/verifyDynamicJwt.ts'), src.replace(JWKS_TEMPLATE, local));
process.env.DYNAMIC_ENVIRONMENT_ID = 'test-env';
const {verifyDynamicJwt, userFromRequest} = await import(pathToFileURL(join(HERE, 'run/verifyDynamicJwt.ts')).href);

const base = {sub: 'user-1', email: 'a@b.c', verified_credentials: [{id: 'vc1', address: '0xabc', chain: 'eip155'}, {id: 'vc2'}]};
const sign = (p: object, opts: jwt.SignOptions = {}, key = privateKey) => jwt.sign(p, key, {algorithm: 'RS256', keyid: kid, expiresIn: '1h', ...opts});
const cases: [string, string, boolean][] = [
  ['valid user:basic', sign({...base, scope: 'user:basic'}), true],
  ['valid multi-scope', sign({...base, scope: 'foo user:basic'}), true],
  ['MFA pending (requiresAdditionalAuth)', sign({...base, scope: 'requiresAdditionalAuth'}), false],
  ['no scope', sign({...base}), false],
  ['expired', sign({...base, scope: 'user:basic'}, {expiresIn: -10}), false],
  ['wrong signing key', sign({...base, scope: 'user:basic'}, {}, other.privateKey), false],
  ['HS256 forgery', jwt.sign({...base, scope: 'user:basic'}, 'secret', {algorithm: 'HS256', keyid: kid}), false],
  ['garbage', 'not.a.jwt', false]
];
for (const [name, token, expectOk] of cases) {
  let accepted = true, msg = '';
  try { await verifyDynamicJwt(token); } catch (e) { accepted = false; msg = (e as Error).message; }
  ok(accepted === expectOk, `jwt: ${name} -> ${expectOk ? 'accepted' : 'rejected'}`, msg);
}
const user = await userFromRequest(`Bearer ${cases[0][1]}`);
ok(user.userId === 'user-1' && user.email === 'a@b.c' && JSON.stringify(user.wallets) === '["0xabc"]', 'userFromRequest returns sub, email, wallet addresses', JSON.stringify(user));
let missing = '';
try { await userFromRequest(undefined); } catch (e) { missing = (e as Error).message; }
ok(missing === 'Missing bearer token', 'userFromRequest without header throws', missing);
server.close();

// 2. Custom networks (recipes.md #6) and the wagmi mapping
const {customEvmNetworks} = await import(pathToFileURL(blockFile('export function toEvmNetwork')).href);
ok(JSON.stringify(customEvmNetworks.map((n: {chainId: number}) => n.chainId)) === '[4801,1301]', 'customEvmNetworks are World Chain Sepolia and Unichain Sepolia');
for (const n of customEvmNetworks) {
  const chain = getOrMapViemChain(n);
  ok(chain.id === n.chainId && chain.rpcUrls.default.http[0] === n.rpcUrls[0] && n.nativeCurrency.decimals === 18,
    `getOrMapViemChain(${n.name}) -> chain ${chain.id}`, chain.rpcUrls.default.http[0]);
}

// 3. Chain IDs from chains.md
const c = viemChains as unknown as Record<string, Chain>;
const table: [string, number, boolean][] = [ // [viem export, id, check the RPC]
  ['worldchain', 480, true], ['worldchainSepolia', 4801, true], ['unichain', 130, true], ['unichainSepolia', 1301, true],
  ['arc', 5042, true], ['arcTestnet', 5042002, true], ['hedera', 295, false], ['hederaTestnet', 296, true],
  ['zeroGTestnet', 16602, true], ['zeroGMainnet', 16661, false], ['whitechainSepolia', 1874, false], ['whitechain', 1875, false]
];
for (const [name, id] of table) ok(c[name]?.id === id, `viem ${name} id is ${id}`, String(c[name]?.id));
ok(c.zeroGGalileoTestnet?.id === 16601, 'viem zeroGGalileoTestnet is the old 16601 (chains.md says deprecated)', String(c.zeroGGalileoTestnet?.id));
if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }

// 4. Network: public RPCs and the Dynamic JWKS endpoint
let network = 0;
for (const [name, id, rpc] of table) {
  if (!rpc) continue;
  try {
    const got = await createPublicClient({chain: c[name], transport: http(undefined, {timeout: 15_000, retryCount: 2})}).getChainId();
    ok(got === id, `${name} public RPC reports chainId ${id}`, String(got));
  } catch (e) {
    network++;
    console.log(`~    ${name} public RPC unreachable: ${(e as Error).message.split('\n')[0]}`);
  }
}
try {
  const res = await fetch('https://app.dynamicauth.com/api/v0/sdk/00000000-0000-0000-0000-000000000000/.well-known/jwks', {signal: AbortSignal.timeout(15_000)});
  if (res.status >= 500 || res.status === 429) { network++; console.log(`~    Dynamic JWKS endpoint returned ${res.status}`); }
  else ok(res.status < 500, 'Dynamic JWKS host and path answer', `HTTP ${res.status} for a dummy environment`);
} catch (e) {
  network++;
  console.log(`~    Dynamic JWKS endpoint unreachable: ${(e as Error).message}`);
}
if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
if (network) process.exit(75);
console.log('\nall dynamic live checks passed');
process.exit(0); // don't wait for idle keep-alive sockets
