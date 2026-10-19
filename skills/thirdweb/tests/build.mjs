// Builds the skill's Next.js quickstart as a real app: copies the skill's own code blocks (client.ts, layout,
// page.tsx and the React recipes) from blocks/ into app/src/app, then runs `next build` with a placeholder Client ID.
// The @x402/* packages in package.json are the workaround from references/errors.md #1; without them this build fails.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const blocks = readdirSync("blocks").map((f) => ({ f, text: readFileSync(`blocks/${f}`, "utf8") }));
const find = (label, test) => {
  const b = blocks.find(test);
  if (!b) { console.error(`build: could not find the ${label} block in the skill`); process.exit(1); }
  console.log(`build: ${label} <- blocks/${b.f}`);
  return b.text;
};
const client = find("client.ts", (b) => b.f.startsWith("SKILL-") && b.text.includes("NEXT_PUBLIC_THIRDWEB_CLIENT_ID") && b.text.includes("createThirdwebClient"));
const page = find("page.tsx", (b) => b.f.startsWith("SKILL-") && b.text.includes("export default function Home"));
const layout = find("layout.tsx", (b) => b.text.includes("<ThirdwebProvider>{children}</ThirdwebProvider>"));
const login = find("recipes Login", (b) => b.text.includes("export function Login"));
const read = find("recipes ReadExample", (b) => b.text.includes("export function ReadExample"));
const sponsored = find("recipes sponsored wallets", (b) => b.text.includes("Sponsored7702"));

const app = "app/src/app";
mkdirSync(`${app}/recipes`, { recursive: true });
writeFileSync(`${app}/client.ts`, client);
writeFileSync(`${app}/layout.tsx`, layout);
writeFileSync(`${app}/page.tsx`, page);
writeFileSync(`${app}/recipes/client.ts`, client);
writeFileSync(`${app}/recipes/login.tsx`, login);
writeFileSync(`${app}/recipes/read.tsx`, read);
writeFileSync(`${app}/recipes/sponsored.tsx`, sponsored);
writeFileSync(`${app}/recipes/page.tsx`, `"use client";
import { Login } from "./login";
import { ReadExample } from "./read";
import { Sponsored7702, Sponsored4337, SponsoredAll } from "./sponsored";
export default function Recipes() {
  return (<main><Login /><ReadExample /><Sponsored7702 /><Sponsored4337 /><SponsoredAll /></main>);
}
`);

const r = spawnSync("npx", ["next", "build", "app"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_THIRDWEB_CLIENT_ID: "placeholder-client-id", NEXT_TELEMETRY_DISABLED: "1" },
});
process.exit(r.status ?? 1);
