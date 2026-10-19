// Key-free checks for the privy skill. Run by scripts/verify.mjs after the blocks are written to blocks/.
//   1. recipes.md #6 route handler (the real block): verifies tokens signed with a throwaway local ES256 key.
//      jwtVerificationKey is set, so nothing is sent to Privy.
//   2. recipes.md #7 addRpcUrlOverrideToChain (the real block) at runtime.
//   3. Chain IDs from references/chains.md against viem and each chain's public RPC (network).
// Exit 0 = pass, 1 = real failure, 75 = a public RPC could not be reached.
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {generateKeyPair, exportSPKI, SignJWT} from 'jose';
import {createPublicClient, http, type Chain} from 'viem';
import {worldchain, worldchainSepolia, unichain, unichainSepolia} from 'viem/chains';

const BLOCKS = join(import.meta.dirname, 'blocks');
let failed = 0;
const ok = (cond: boolean, label: string, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${extra ? ` (${extra})` : ''}`);
  if (!cond) failed++;
};
/** Finds the block whose source contains every needle, so renumbering the skill's blocks doesn't break the test. */
const block = (...needles: string[]) => {
  const f = readdirSync(BLOCKS).find((n) => needles.every((s) => readFileSync(join(BLOCKS, n), 'utf8').includes(s)));
  if (!f) throw new Error(`no code block in the skill contains ${needles.join(' + ')}`);
  return pathToFileURL(join(BLOCKS, f)).href;
};

// 1. Server verification route (recipes.md #6)
const APP_ID = 'cltestappid0000000000000a';
const {publicKey, privateKey} = await generateKeyPair('ES256');
process.env.PRIVY_APP_ID = APP_ID;
process.env.PRIVY_APP_SECRET = 'not-a-real-secret';
process.env.PRIVY_VERIFICATION_KEY = await exportSPKI(publicKey);
const route = await import(block('export async function GET', 'verifyAccessToken'));
const sign = (aud: string, exp: string | number = '1h') =>
  new SignJWT({sid: 'sess_1'}).setProtectedHeader({alg: 'ES256', typ: 'JWT'}).setIssuer('privy.io').setAudience(aud)
    .setSubject('did:privy:test-user').setIssuedAt().setExpirationTime(exp).sign(privateKey);
const call = async (auth?: string) => {
  const res: Response = await route.GET(new Request('http://localhost/api/me', {headers: auth ? {authorization: auth} : {}}));
  return {status: res.status, body: await res.json()};
};
let r = await call();
ok(r.status === 401 && r.body.error === 'missing token', 'route: no header -> 401 missing token', JSON.stringify(r.body));
r = await call('Bearer not-a-jwt');
ok(r.status === 401 && r.body.error === 'invalid token', 'route: garbage token -> 401', JSON.stringify(r.body));
r = await call(`Bearer ${await sign(APP_ID)}`);
ok(r.status === 200 && r.body.userId === 'did:privy:test-user' && r.body.sessionId === 'sess_1', 'route: valid token -> 200 with snake_case claims mapped', JSON.stringify(r.body));
r = await call(`Bearer ${await sign('some-other-app')}`);
ok(r.status === 401, 'route: wrong audience -> 401');
r = await call(`Bearer ${await sign(APP_ID, Math.floor(Date.now() / 1000) - 10)}`);
ok(r.status === 401, 'route: expired token -> 401');

// errors.md #1: the docs' object form must still be rejected, or the skill's warning is out of date.
const {PrivyClient} = await import('@privy-io/node');
const privy = new PrivyClient({appId: APP_ID, appSecret: 'x', jwtVerificationKey: process.env.PRIVY_VERIFICATION_KEY});
const claims = await privy.utils().auth().verifyAccessToken(await sign(APP_ID));
ok(claims.user_id === 'did:privy:test-user' && claims.app_id === APP_ID && claims.session_id === 'sess_1', 'verifyAccessToken(string) returns snake_case claims', Object.keys(claims).join(','));
let objectForm = 'accepted';
try { await privy.utils().auth().verifyAccessToken({access_token: await sign(APP_ID)} as never); } catch { objectForm = 'rejected'; }
ok(objectForm === 'rejected', 'errors.md #1: verifyAccessToken({access_token}) still rejected', objectForm);

// 2. addRpcUrlOverrideToChain (recipes.md #7)
const {worldchainSepoliaRpc} = await import(block('addRpcUrlOverrideToChain', 'worldchainSepoliaRpc'));
ok(JSON.stringify(worldchainSepoliaRpc.rpcUrls.privyWalletOverride?.http) === '["<YOUR_RPC_URL>"]', 'addRpcUrlOverrideToChain sets rpcUrls.privyWalletOverride');
ok(worldchainSepoliaRpc.rpcUrls.default.http[0] === worldchainSepolia.rpcUrls.default.http[0] && worldchainSepoliaRpc.id === 4801, 'addRpcUrlOverrideToChain keeps the default RPC and chain id');

// 3. Sponsor chains (chains.md): config IDs, then the public RPCs
const expected: [Chain, number][] = [[worldchain, 480], [worldchainSepolia, 4801], [unichain, 130], [unichainSepolia, 1301]];
for (const [chain, id] of expected) ok(chain.id === id, `viem ${chain.name} id is ${id}`, String(chain.id));
if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }

let network = 0;
for (const [chain, id] of expected) {
  try {
    const client = createPublicClient({chain, transport: http(undefined, {timeout: 15_000, retryCount: 2})});
    const rpcId = await client.getChainId();
    ok(rpcId === id, `${chain.name} public RPC reports chainId ${id}`, `${rpcId}, block ${await client.getBlockNumber()}`);
  } catch (e) {
    network++;
    console.log(`~    ${chain.name} public RPC unreachable: ${(e as Error).message.split('\n')[0]}`);
  }
}
if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
if (network) process.exit(75);
console.log('\nall privy live checks passed');
