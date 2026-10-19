// Key-free live checks against Onramp's public API (GET only, no keys). Exit 75 = network problem, 1 = real failure.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const NETWORK = 75, API = "https://api.onramp.money";
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`), bad = (m) => { failed++; console.error(`  ✗ ${m}`); };
const net = (e) => { console.error(`network: ${e?.cause?.code || e?.message || e}`); process.exit(NETWORK); };
async function get(path) {
  let res;
  try { res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(20000) }); } catch (e) { net(e); }
  if (res.status >= 500 || res.status === 429) net(`HTTP ${res.status} for ${path}`);
  return { status: res.status, json: await res.json().catch(() => null) };
}

console.log("Public config API");
const coins = await get("/onramp/api/v3/buy/public/listAllCoins");
coins.json?.status === 1 && coins.json.data?.usdt && coins.json.data?.usdc ? ok(`listAllCoins: ${Object.keys(coins.json.data).length} coins incl. usdt, usdc`) : bad(`listAllCoins: ${coins.status} ${JSON.stringify(coins.json).slice(0, 200)}`);

const missing = await get("/onramp/api/v3/buy/public/coinNetworks");
missing.status === 400 && /Missing parameter/.test(missing.json?.error) ? ok(`coinNetworks without params: 400 "${missing.json.error}"`) : bad(`coinNetworks without params: ${missing.status} ${JSON.stringify(missing.json)}`);

const symbols = async (coin) => {
  const r = await get(`/onramp/api/v3/buy/public/coinNetworks?coinCode=${coin}&fiatType=1`);
  if (r.json?.status !== 1) { bad(`coinNetworks ${coin}: ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); return {}; }
  const { coinConfig, networkConfig } = r.json.data;
  return Object.fromEntries((coinConfig?.networks ?? []).map((id) => [networkConfig[String(id)]?.chainSymbol, { id, ...networkConfig[String(id)] }]).filter(([s]) => s));
};
const usdt = await symbols("usdt");
["bep20", "matic20", "bep20-test"].every((s) => usdt[s]) ? ok(`usdt/INR networks include bep20, matic20 and the sandbox bep20-test (errors.md #1); ${Object.keys(usdt).length} total`) : bad(`usdt/INR networks missing one of bep20, matic20, bep20-test: ${Object.keys(usdt).join(", ")}`);
if (usdt["bep20-test"] && usdt["bep20-test"].networkId !== undefined && Number(usdt["bep20-test"].networkId) !== 97) bad(`bep20-test networkId is ${usdt["bep20-test"].networkId}, errors.md #1 says chain id 97`);
if (usdt.matic20 && usdt.matic20.id !== 3) bad(`matic20 is Onramp id ${usdt.matic20.id}, errors.md #2 says 3`);
const usdc = await symbols("usdc");
["wld", "arc", "hbar"].every((s) => usdc[s]) ? ok("usdc/INR still lists wld, arc and hbar (chains.md)") : bad(`chains.md says USDC lists wld, arc and hbar; API lists: ${Object.keys(usdc).join(", ")}`);

console.log("recipes.md coin/price block, run for real");
const block = readdirSync("blocks").sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, "utf8") })).find((b) => b.code.includes("export async function getBuyPrice"));
if (!block) bad("no getBuyNetworks/getBuyPrice block found");
else {
  const r = spawnSync(process.execPath, ["node_modules/.bin/tsx", `blocks/${block.f}`], { encoding: "utf8", timeout: 60000 });
  const out = `${r.stdout}${r.stderr}`;
  if (r.status !== 0 && /fetch failed|ENOTFOUND|ETIMEDOUT|ECONNRESET/.test(out)) net(out.slice(0, 200));
  r.status === 0 && out.includes("matic20") && /price:\s*[\d.]+/.test(out) ? ok(`${block.f}: printed networks and a price (${(out.match(/price:\s*[\d.]+/) || [""])[0]})`) : bad(`${block.f}: exit ${r.status}: ${out.slice(-400)}`);
}

console.log("Other public endpoints the skill names");
const sellCfg = await get("/onramp/api/v2/sell/public/allConfig");
sellCfg.json?.status === 1 && sellCfg.json.data?.allCoinConfig ? ok("sell allConfig: status 1, allCoinConfig present") : bad(`sell allConfig: ${sellCfg.status} ${JSON.stringify(sellCfg.json).slice(0, 200)}`);
const time = await get("/onramp/api/v2/common/public/currentTimestamp");
const skew = Math.abs(Number(time.json?.data) - Date.now());
time.json?.status === 1 && skew < 10 * 60 * 1000 ? ok(`currentTimestamp: ${time.json.data} (local clock off by ${Math.round(skew / 1000)} s)`) : bad(`currentTimestamp: ${JSON.stringify(time.json)}`);
const gen = await get("/sdk-apis/generate-url?appId=2&mode=embedded&flowType=1&coinCode=usdt&network=bep20-test&fiatType=1&fiatAmount=1000");
const genUrl = gen.json?.data?.url || "";
gen.json?.status === 1 && genUrl.startsWith("https://onramp.money/main/buy/?appId=2") && genUrl.includes("network=bep20-test") ? ok(`sdk-apis/generate-url (what show() calls): ${genUrl.slice(0, 80)}...`) : bad(`generate-url: ${gen.status} ${JSON.stringify(gen.json).slice(0, 200)}`);

if (failed) { console.error(`${failed} live check(s) failed`); process.exit(1); }
console.log("live: all checks passed");
