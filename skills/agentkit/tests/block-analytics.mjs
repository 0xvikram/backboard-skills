// Loaded with `node --import` before anything else. AgentKit 0.10.4 POSTs usage analytics to cca-lite.coinbase.com
// when a wallet provider is created and on every action (references/errors.md #8). This answers those requests
// locally, so nothing is sent to Coinbase; live.js checks the counter to prove the stub caught them.
const realFetch = globalThis.fetch;
globalThis.__analyticsBlocked = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url ?? input);
  if (/^https?:\/\/[^/]*coinbase\.com/i.test(url)) {
    globalThis.__analyticsBlocked++;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(input, init);
};
