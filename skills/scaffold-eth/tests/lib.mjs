// Shared helpers: scaffold a real create-eth project and drop the skill's code blocks into it.
// The blocks come from blocks/ (written by scripts/verify.mjs from SKILL.md and references/*.md).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const BLOCKS = join(HERE, "blocks");
export const CREATE_ETH = "2.0.23"; // the version the skill pins (npx create-eth@2.0.23)

// create-eth needs yarn on PATH and a git identity (it makes the first commit). Use the local yarn from devDependencies
// and a throwaway git config, so nothing global is needed or changed.
const gitConfig = join(HERE, ".gitconfig-verify");
export const ENV = {
  ...process.env,
  PATH: `${join(HERE, "node_modules", ".bin")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`,
  GIT_CONFIG_GLOBAL: gitConfig,
  GIT_CONFIG_NOSYSTEM: "1",
  YARN_ENABLE_IMMUTABLE_INSTALLS: "false", // CI=1 would otherwise make yarn 4 refuse any lockfile change
  YARN_ENABLE_TELEMETRY: "0",
  NEXT_TELEMETRY_DISABLED: "1",
};

export function run(cmd, args, cwd, { capture = false, allowFail = false } = {}) {
  const t = Date.now();
  const r = spawnSync(cmd, args, { cwd, env: ENV, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"], maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const secs = ((Date.now() - t) / 1000).toFixed(0);
  if (r.status !== 0 && !allowFail) {
    if (capture) console.error(out.split("\n").slice(-60).join("\n"));
    throw new Error(`${cmd} ${args.join(" ")} failed in ${cwd} (exit ${r.status}, ${secs}s)`);
  }
  return { code: r.status ?? 1, out, secs };
}

// Scaffold `<parent>/<name>` with the pinned create-eth, Hardhat flavour, no prompts.
export function scaffold(parent, name, { install }) {
  writeFileSync(gitConfig, "[user]\n\tname = verify\n\temail = verify@example.invalid\n[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n");
  mkdirSync(parent, { recursive: true });
  rmSync(join(parent, name), { recursive: true, force: true });
  const bin = join(HERE, "node_modules", "create-eth", "bin", "create-dapp-se2.js");
  const r = run(process.execPath, [bin, name, "-s", "hardhat", ...(install ? [] : ["--skip-install"])], parent, { capture: !install });
  console.log(`  create-eth@${CREATE_ETH} ${name} -s hardhat${install ? "" : " --skip-install"}: ${r.secs}s`);
  const dir = join(parent, name);
  if (!existsSync(join(dir, "packages", "nextjs", "scaffold.config.ts"))) throw new Error("create-eth did not write packages/nextjs/scaffold.config.ts");
  return dir;
}

// ---- the skill's blocks, sorted by what they are -------------------------------------------------------------------
export function classify() {
  const b = { pages: [], config: null, chainsSnippet: null, customChains: null, external: null, fragments: [], deploy: null, hhNetworks: null, unknown: [] };
  for (const file of readdirSync(BLOCKS).sort()) {
    const text = readFileSync(join(BLOCKS, file), "utf8"), blk = { file, name: file.replace(/\.[^.]+$/, ""), text };
    if (/^\s*targetNetworks:\s*\[/.test(text)) b.chainsSnippet = blk;
    else if (/const scaffoldConfig\s*=/.test(text)) b.config = blk;
    else if (/defineChain\(/.test(text) && /export const/.test(text)) b.customChains = blk;
    else if (/const externalContracts\s*=/.test(text)) b.external = blk;
    else if (/deployScript\(/.test(text)) b.deploy = blk;
    else if (/^\s*\w+:\s*\{\s*type:\s*"http"/m.test(text)) b.hhNetworks = blk;
    else if (file.endsWith(".tsx") && /export default/.test(text)) b.pages.push(blk);
    else if (file.endsWith(".tsx")) b.fragments.push(blk);
    else b.unknown.push(blk);
  }
  const missing = ["chainsSnippet", "config", "customChains", "external", "deploy", "hhNetworks"].filter((k) => !b[k]);
  if (missing.length) throw new Error(`expected blocks not found in the skill: ${missing.join(", ")}`);
  if (b.unknown.length) throw new Error(`blocks this test suite does not know how to check: ${b.unknown.map((x) => x.file).join(", ")} (add them to lib.mjs)`);
  return b;
}

// A fragment like `const { data } = useScaffoldReadContract(...)` becomes a client page that calls it.
export function wrapFragment(text) {
  const lines = text.split("\n"), imports = lines.filter((l) => /^import\s/.test(l)), body = lines.filter((l) => !/^import\s/.test(l));
  const hooks = [...new Set([...text.matchAll(/\b(useScaffold\w+)\(/g)].map((m) => m[1]))].filter((h) => !imports.some((i) => i.includes(h)));
  if (hooks.length) imports.push(`import { ${hooks.join(", ")} } from "~~/hooks/scaffold-eth";`);
  const names = [...text.matchAll(/const\s*\{([^}]*)\}\s*=/g)].flatMap((m) => m[1].split(",").map((p) => p.split(":").pop().trim()).filter(Boolean));
  return `"use client";\n${imports.join("\n")}\n\nexport default function VerifyFragment() {\n${body.map((l) => `  ${l}`).join("\n")}\n  return <pre>{String([${names.join(", ")}].length)}</pre>;\n}\n`;
}

const isWeth = (blk) => /contractName:\s*"WETH"/.test(blk.text);

// Variant A ("local + sponsors"): the generated scaffold.config.ts with the chains.md snippet applied, hardhat kept first
// (as the skill advises while developing) and the recipe 4b Arc mainnet defineChain added. Pages: the SKILL.md /
// quickstart / recipe 3 pages (YourContract) and any fragment that does not need WETH (recipe 6 wagmi read).
// Variant B ("sponsor first"): recipe 4a's scaffold.config.ts (all commented chains uncommented), recipe 6's
// externalContracts.ts and the WETH fragments.
export function applyVariant(nextjsDir, variant, b, deployedContractsFixture) {
  const cfgPath = join(nextjsDir, "scaffold.config.ts"), generated = readFileSync(join(nextjsDir, "scaffold.config.ts.generated"), "utf8");
  const appDir = join(nextjsDir, "app");
  for (const d of readdirSync(appDir)) if (d.startsWith("verify-")) rmSync(join(appDir, d), { recursive: true, force: true });
  if (deployedContractsFixture) writeFileSync(join(nextjsDir, "contracts", "deployedContracts.ts"), deployedContractsFixture);
  mkdirSync(join(nextjsDir, "utils"), { recursive: true });
  writeFileSync(join(nextjsDir, "utils", "customChains.ts"), b.customChains.text);
  const addPage = (name, src) => { mkdirSync(join(appDir, `verify-${name.toLowerCase()}`), { recursive: true }); writeFileSync(join(appDir, `verify-${name.toLowerCase()}`, "page.tsx"), src); };

  if (variant === "A") {
    const snippet = b.chainsSnippet.text.trim().replace(/^targetNetworks:\s*\[/, "targetNetworks: [\n  chains.hardhat,").replace(/\n\],\s*\nrpcOverrides/, "\n  arcMainnet,\n],\nrpcOverrides");
    if (!snippet.includes("arcMainnet") || !snippet.includes("chains.hardhat")) throw new Error("could not apply the chains.md snippet to scaffold.config.ts");
    let cfg = generated.replace(/rpcOverrides:\s*\{[\s\S]*?\},/, "");
    cfg = cfg.replace(/targetNetworks:\s*\[[\s\S]*?\],/, snippet.split("\n").map((l) => `  ${l}`).join("\n").trimStart());
    cfg = cfg.replace(/^(import \* as chains from "viem\/chains";)/m, `$1\nimport { arcMainnet } from "./utils/customChains";`);
    writeFileSync(cfgPath, cfg);
    writeFileSync(join(nextjsDir, "contracts", "externalContracts.ts"), readFileSync(join(nextjsDir, "contracts", "externalContracts.ts.generated"), "utf8"));
    for (const p of b.pages.filter((p) => !isWeth(p))) addPage(p.name, p.text);
    for (const f of b.fragments.filter((f) => !isWeth(f))) addPage(f.name, wrapFragment(f.text));
  } else {
    const t = b.config.text, at = t.indexOf("const scaffoldConfig");
    const header = t.slice(0, at).replace(/^\/\/\s*(import \{ arcMainnet \}[^;]*;).*$/m, "$1");
    const body = t.slice(at).replace(/^(\s*)\/\/\s*((?:chains\.\w+|arcMainnet),)/gm, "$1$2");
    const middle = generated.slice(generated.indexOf("export type BaseConfig"), generated.indexOf("const scaffoldConfig"));
    if (!middle) throw new Error("generated scaffold.config.ts has no BaseConfig type");
    writeFileSync(cfgPath, `${header}${middle}${body.trimEnd()}\n\nexport default scaffoldConfig;\n`);
    writeFileSync(join(nextjsDir, "contracts", "externalContracts.ts"), b.external.text);
    for (const p of b.pages.filter(isWeth)) addPage(p.name, p.text);
    for (const f of b.fragments) addPage(f.name, wrapFragment(f.text));
  }
}

// Keep pristine copies of the generated files the variants rewrite.
export function snapshotGenerated(nextjsDir) {
  for (const f of ["scaffold.config.ts", "contracts/externalContracts.ts"]) {
    const p = join(nextjsDir, f);
    if (!existsSync(`${p}.generated`)) writeFileSync(`${p}.generated`, readFileSync(p, "utf8"));
  }
}

// Hardhat 3 networks fragment (recipe 4c) as a typed object.
export function hardhatNetworksFile(b) {
  return `import type { HardhatUserConfig } from "hardhat/config";\n\ndeclare const deployerPrivateKey: string;\n\nexport const networks: HardhatUserConfig["networks"] = {\n${b.hhNetworks.text.trimEnd()}\n};\n`;
}

// Strip comments/whitespace so a block can be compared with the template's generated file.
export const codeTokens = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/\s+/g, "");
