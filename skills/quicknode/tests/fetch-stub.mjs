// Preloaded (node --import) when live.ts runs the skill's Streams/Webhooks REST scripts: requests to api.quicknode.com
// are NOT sent. The request is printed as one "STUB <method> <url> <json body>" line and a fake 200 reply is returned.
const real = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  if (!url.startsWith("https://api.quicknode.com/")) return real(input, init);
  console.log(`STUB ${init.method ?? "GET"} ${url} ${init.body ?? ""}`);
  return new Response(JSON.stringify({ id: "stubbed", status: "active" }), { status: 200, headers: { "content-type": "application/json" } });
};
