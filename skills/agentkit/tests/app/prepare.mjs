// Builds the Next.js app the way the skill tells users to: its next.config.js block (with the serverExternalPackages
// fix, recipes.md #1) and its App Router route block (recipes.md, Vercel AI SDK in a Next.js route) are copied in
// verbatim from blocks/ (found by content, so renumbering the skill doesn't matter), then `next build` runs.
import { copyFileSync, readdirSync, readFileSync } from "node:fs";

const dir = new URL("../blocks/", import.meta.url);
const find = (ext, ...needles) => {
  const f = readdirSync(dir).find((n) => n.endsWith(ext) && needles.every((s) => readFileSync(new URL(n, dir), "utf8").includes(s)));
  if (!f) { console.error(`no ${ext} block in the skill contains ${needles.join(" + ")}`); process.exit(1); }
  return new URL(f, dir);
};
const config = find(".js", "serverExternalPackages", "@coinbase/agentkit");
const route = find(".ts", "export async function POST", "getVercelAITools");
copyFileSync(config, new URL("./next.config.js", import.meta.url));
copyFileSync(route, new URL("./app/api/agent/route.ts", import.meta.url));
console.log(`next.config.js <- ${config.pathname.split("/").pop()}, app/api/agent/route.ts <- ${route.pathname.split("/").pop()}`);
