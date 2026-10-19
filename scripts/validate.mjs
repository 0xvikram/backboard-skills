// Checks every skill before it can be merged. Run: node scripts/validate.mjs
// A skill is instructions an AI assistant follows on a hacker's machine, so besides the format this blocks the things a
// skill must never contain: piped installers, secrets and private keys.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { skills, frontMatter, ROOT } from "./lib.mjs";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FORBIDDEN = [
  [/\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba|z)?sh\b/i, "pipes a download straight into a shell"],
  [/\brm\s+-rf\s+[\/~]/, "deletes from / or ~"],
  [/\b0x[0-9a-fA-F]{64}\b/, "contains what looks like a private key (64 hex characters)"],
  [/\b(sk|pk)_(live|test)_[0-9A-Za-z]{16,}/, "contains what looks like an API key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "contains what looks like an API key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "contains what looks like an AWS key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "contains what looks like a GitHub token"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "contains a private key"],
];
const MAX_BYTES = 100_000;

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });

const all = skills();
const names = new Map();
for (const s of all) {
  const where = `skills/${s.dir}`;
  if (s.text === null) { fail(where, "has no SKILL.md"); continue; }
  const fm = frontMatter(s.text);
  if (!fm) { fail(where, "SKILL.md must start with front matter between --- lines"); continue; }
  const { name, description } = fm.data;
  if (!name) fail(where, "front matter needs a `name`");
  else {
    if (name !== s.dir) fail(where, `name "${name}" must match the folder name "${s.dir}"`);
    if (!NAME.test(name) || name.length > 64) fail(where, "name must be lowercase letters, numbers and single hyphens, at most 64 characters");
    if (names.has(name)) fail(where, `name "${name}" is also used by skills/${names.get(name)}`);
    names.set(name, s.dir);
  }
  if (!description) fail(where, "front matter needs a `description`");
  else {
    if (description.length > 1024) fail(where, `description is ${description.length} characters; the limit is 1024`);
    if (/[<>]/.test(description)) fail(where, "description must not contain < or >");
  }
  if (!/^#\s+\S/m.test(fm.body)) fail(where, "SKILL.md needs a `# Title` heading");
  // relative links in the skill must point at files that exist
  for (const [, link] of fm.body.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
    const target = join(ROOT, where, link.split("#")[0]);
    if (!existsSync(target)) fail(where, `links to ${link}, which doesn't exist`);
  }
  for (const f of files(join(ROOT, where))) {
    const rel = relative(ROOT, f), text = readFileSync(f, "utf8");
    if (Buffer.byteLength(text) > MAX_BYTES) fail(rel, `is over ${MAX_BYTES / 1000} KB`);
    for (const [re, why] of FORBIDDEN) if (re.test(text)) fail(rel, why);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem${errors.length === 1 ? "" : "s"} in ${all.length} skills:\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${all.length} skills are valid`);
