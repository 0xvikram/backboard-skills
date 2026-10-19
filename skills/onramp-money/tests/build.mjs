// errors.md #5: bundlers resolve the SDK's ES build through its `module` field. Bundle the React component block and
// the overlay quickstart block for the browser with esbuild and check the SDK class made it in.
import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const blocks = readdirSync("blocks").sort().map((f) => ({ f, code: readFileSync(`blocks/${f}`, "utf8") })).filter((b) => b.code.includes("@onramp.money/onramp-web-sdk"));
if (blocks.length < 2) { console.error(`expected 2 SDK blocks, found ${blocks.length}`); process.exit(1); }
writeFileSync("bundle-entry.tsx", blocks.map((b, i) => `import * as m${i} from "./blocks/${b.f}";\nconsole.log(m${i});`).join("\n") + "\n");
const r = await build({ entryPoints: ["bundle-entry.tsx"], bundle: true, platform: "browser", format: "esm", jsx: "automatic", write: false, metafile: true, logLevel: "error" });
const inputs = Object.keys(r.metafile.inputs).filter((p) => p.includes("onramp-web-sdk"));
const code = r.outputFiles[0].text;
if (!inputs.some((p) => p.endsWith("dist/onramp-web-sdk.es5.js")) || !/OnrampWebSDK/.test(code)) { console.error(`esbuild did not pull in the SDK's ES build: ${inputs.join(", ")}`); process.exit(1); }
console.log(`  ✓ esbuild browser bundle of ${blocks.map((b) => b.f).join(" + ")}: ${(code.length / 1024).toFixed(0)} KB, SDK from ${inputs.find((p) => p.endsWith(".js"))}`);
