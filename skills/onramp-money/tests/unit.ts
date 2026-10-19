// Local checks (no network): URL builder, request signing + webhook verification, the Express webhook block, and the
// web SDK in jsdom with fetch stubbed. Imports the skill's own blocks (prep.mjs adds the onramp-url/onramp-api names).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import { readdirSync, readFileSync } from 'node:fs';
import CryptoJS from 'crypto-js';
import { JSDOM } from 'jsdom';

const blocks = readdirSync('blocks').sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, 'utf8') }));
const byContent = (test: (c: string) => boolean, desc: string) => {
  const b = blocks.find((x) => !['onramp-url.ts', 'onramp-api.ts'].includes(x.f) && test(x.code));
  assert.ok(b, `no block found for ${desc}`);
  return b!;
};
const ok = (m: string) => console.log(`  ✓ ${m}`);
const DOCS_URL = 'https://onramp.money/main/buy/?appId=1&walletAddress=0xf142123879b4611Cd4a30C1E0929217C0d4fB37f&coinCode=usdt&network=matic20&fiatAmount=150&fiatType=1&paymentMethod=1';
const runTs = (file: string, env: Record<string, string> = {}) => spawnSync(process.execPath, ['node_modules/.bin/tsx', file], { encoding: 'utf8', env: { ...process.env, ...env } });

console.log('URL builder (quickstart.md, SKILL.md, recipes 1-2)');
const { buildOnrampUrl } = await import('./blocks/onramp-url.ts');
const buy = buildOnrampUrl('buy', { appId: 1, walletAddress: '0xf142123879b4611Cd4a30C1E0929217C0d4fB37f', coinCode: 'usdt', network: 'matic20', fiatAmount: 150, fiatType: 1, paymentMethod: 1 });
assert.equal(buy, DOCS_URL); ok('matches the hosted-mode docs example URL byte for byte');
const sell = buildOnrampUrl('sell', { appId: 2, coinCode: 'usdt', network: 'bep20-test', coinAmount: 5, phoneNumber: '+91-9876543210', redirectUrl: 'https://myapp.xyz/done?x=1' });
assert.ok(sell.startsWith('https://onramp.money/main/sell/?appId=2'), sell);
assert.ok(sell.includes('phoneNumber=%2B91-9876543210'), sell);
assert.ok(sell.includes('redirectUrl=https%3A%2F%2Fmyapp.xyz%2Fdone%3Fx%3D1'), sell); ok('phoneNumber "+91-..." -> %2B91-..., redirectUrl encoded');
assert.throws(() => buildOnrampUrl('buy', { appId: 2, fiatAmount: 1, coinAmount: 1 }), /not both/); ok('fiatAmount + coinAmount throws');
const skill = byContent((c) => /function buildOnrampUrl/.test(c) && !/export interface/.test(c), 'SKILL.md URL builder');
const qs = byContent((c) => /export interface OnrampUrlParams/.test(c), 'quickstart URL builder');
const outSkill = runTs(`blocks/${skill.f}`), outQs = runTs(`blocks/${qs.f}`);
assert.equal(outSkill.status, 0, outSkill.stderr); assert.equal(outQs.status, 0, outQs.stderr);
assert.equal(outSkill.stdout.trim(), outQs.stdout.trim(), 'SKILL.md and quickstart.md builders print different URLs');
assert.match(outSkill.stdout, /^https:\/\/onramp\.money\/main\/buy\/\?appId=2&coinCode=usdt&network=bep20-test&/); ok(`${skill.f} and ${qs.f} print the same sandbox URL`);
for (const [desc, test] of [['recipe 1 (buy link)', (c: string) => /merchantRecognitionId: 'order-42'/.test(c)], ['recipe 2 (sell link)', (c: string) => /buildOnrampUrl\('sell'/.test(c)]] as const) {
  const b = byContent(test, desc), r = runTs(`blocks/${b.f}`);
  assert.equal(r.status, 0, `${b.f}: ${r.stderr}`); ok(`${b.f} (${desc}) runs`);
}

console.log('Signing and webhook verification (recipes.md onramp-api.ts)');
const { signOnrampRequest, verifyOnrampWebhook } = await import('./blocks/onramp-api.ts');
const body = { orderId: 89912, type: 1 }, ts = 1792406851892;
const h = signOnrampRequest(body, 'KEY', 'SECRET', ts);
const docsPayload = Buffer.from(JSON.stringify({ timestamp: ts, body })).toString('base64');
const docsSig = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA512(docsPayload, 'SECRET')); // the docs' crypto-js way
assert.equal(h['X-ONRAMP-PAYLOAD'], docsPayload);
assert.equal(h['X-ONRAMP-SIGNATURE'], docsSig); ok('node:crypto signature equals the docs\' crypto-js HMAC-SHA512 hex');
assert.deepEqual(JSON.parse(Buffer.from(h['X-ONRAMP-PAYLOAD'], 'base64').toString()), { timestamp: ts, body }); ok('payload decodes to { timestamp, body }');
assert.equal(verifyOnrampWebhook(docsPayload, docsSig, 'SECRET'), true);
assert.equal(verifyOnrampWebhook(docsPayload, docsSig, 'WRONG'), false);
assert.equal(verifyOnrampWebhook(docsPayload + 'x', docsSig, 'SECRET'), false);
assert.equal(verifyOnrampWebhook(undefined, docsSig, 'SECRET'), false);
assert.equal(verifyOnrampWebhook(docsPayload, 'short', 'SECRET'), false); ok('verify: right secret true; wrong secret, tampered payload, missing header, short signature false');

console.log('Express webhook block (localhost)');
const hook = byContent((c) => /app\.post\('\/onramp\/webhook'/.test(c), 'webhook server');
const port = await new Promise<number>((r) => { const s = createServer().listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => r(p)); }); });
const child = spawn(process.execPath, ['node_modules/.bin/tsx', `blocks/${hook.f}`], { env: { ...process.env, PORT: String(port), ONRAMP_API_SECRET: 'test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => (log += d)); child.stderr.on('data', (d) => (log += d));
for (const t0 = Date.now(); !log.includes('webhook listening') && Date.now() - t0 < 30000;) await new Promise((r) => setTimeout(r, 200));
try {
  const wbody = { orderId: 9, eventType: 'onramp', status: 5, merchantRecognitionId: '13422', transactionHash: '0xabc' };
  const payload = Buffer.from(JSON.stringify(wbody)).toString('base64'); // test value; the real header content is set by Onramp
  const sig = createHmac('sha512', 'test-secret').update(payload).digest('hex');
  const post = (s: string) => fetch(`http://127.0.0.1:${port}/onramp/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-onramp-payload': payload, 'x-onramp-signature': s }, body: JSON.stringify(wbody) }).then((r) => r.status);
  assert.equal(await post(sig), 200); assert.equal(await post(sig), 200);
  assert.equal(await post('0'.repeat(128)), 403);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(log.split('\n').filter((l) => l.includes('onramp order')).length, 1, log); ok('signed POST 200, duplicate 200 + logged once, bad signature 403');
} finally { child.kill(); }

console.log('Web SDK 2.0.1 in jsdom (fetch stubbed, nothing leaves the machine)');
const dom = new JSDOM('<!doctype html><body><div id="onramp-widget" style="height:600px"></div></body>', { url: 'http://localhost:3000/' });
const g = globalThis as any;
for (const k of ['window', 'document', 'CustomEvent']) g[k] = (dom.window as any)[k];
let requested: URL | undefined;
const realFetch = g.fetch;
g.fetch = async (u: string) => { requested = new URL(u); return { ok: true, json: async () => ({ status: 1, data: { url: 'https://onramp.money/main/buy/?appId=2' } }) }; };
const nodeImport: any = await import('@onramp.money/onramp-web-sdk');
assert.equal(typeof nodeImport.OnrampWebSDK, 'undefined', 'plain Node import now has a named export: errors.md #5 may be stale'); ok('plain Node import has no OnrampWebSDK export (errors.md #5)');
// @ts-ignore no types for the dist path
const { OnrampWebSDK } = await import('@onramp.money/onramp-web-sdk/dist/onramp-web-sdk.es5.js');
const base = { appId: 2, flowType: 1, walletAddress: '0xf142123879b4611Cd4a30C1E0929217C0d4fB37f', coinCode: 'usdt', network: 'bep20-test', fiatType: 1 };
await assert.rejects(new OnrampWebSDK({ ...base, fiatAmount: 1000, coinAmount: 5 }).show(), /either coinAmount or fiatAmount/);
await assert.rejects(new OnrampWebSDK({ ...base, fiatAmount: '1000' }).show(), /fiatAmount only accepts number/);
await assert.rejects(new OnrampWebSDK({ ...base, paymentMethod: 3 }).show(), /paymentMethod only accepts/);
await assert.rejects(new OnrampWebSDK({ ...base, phoneNumber: '+91-9876543210' }).show(), /Invalid phoneNumber/);
await assert.rejects(new OnrampWebSDK({ ...base, memo: 'x' }).show(), /deprecated/);
await assert.rejects(new OnrampWebSDK({ ...base, containerId: 'onramp-widget' }).show(), /must start with #/);
await assert.rejects(new OnrampWebSDK({ ...base, theme: { lightMode: { baseColor: 'blue' } } }).show(), /Invaid baseColor/); ok('7 config errors from errors.md #4 reproduced');
const sdk = new OnrampWebSDK({ ...base, fiatAmount: 1000, paymentMethod: 1, phoneNumber: encodeURIComponent('+91-9876543210'), containerId: '#onramp-widget' });
const got: string[] = [];
sdk.on('TX_EVENTS', (e: any) => got.push(e.type));
sdk.on('WIDGET_EVENTS', (e: any) => got.push(e.type));
await sdk.show();
assert.equal(requested!.origin + requested!.pathname, 'https://api.onramp.money/sdk-apis/generate-url');
assert.equal(requested!.searchParams.get('appId'), '2');
assert.equal(requested!.searchParams.get('mode'), 'embedded');
assert.equal(requested!.searchParams.get('network'), 'bep20-test');
assert.equal(requested!.searchParams.get('fiatAmount'), '1000'); ok('show() asks sdk-apis/generate-url with appId, mode=embedded, network, fiatAmount');
const iframe = dom.window.document.querySelector('#onramp-widget iframe#onRampWidget');
assert.ok(iframe); assert.equal(iframe!.getAttribute('src'), 'https://onramp.money/main/buy/?appId=2'); ok('iframe mounts inside #onramp-widget');
await assert.rejects(sdk.show(), /already rendered/);
dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { eventData: { type: 'ONRAMP_WIDGET_TX_COMPLETED', data: { orderId: 1 }, isOnramp: true } } }));
dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { eventData: { type: 'ONRAMP_WIDGET_READY', isOnramp: true } } }));
assert.deepEqual(got, ['ONRAMP_WIDGET_TX_COMPLETED', 'ONRAMP_WIDGET_READY']); ok('postMessage events reach TX_EVENTS / WIDGET_EVENTS with no origin check (errors.md #9)');
sdk.close();
assert.equal(dom.window.document.querySelector('#onRampWidget'), null);
assert.throws(() => sdk.close(), /no widget to close/); ok('close() removes the iframe; second close() throws');
assert.equal(new OnrampWebSDK({ appId: 2, sandbox: true })._appURL, 'https://test.onramp.money/onramp/main'); ok('sandbox: true -> test.onramp.money');
g.fetch = realFetch;
console.log('unit: all local checks passed');
process.exit(0);
