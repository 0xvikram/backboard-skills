// Pulls every code block out of a skill's markdown (SKILL.md and references/*.md) into files a test project can
// type-check, so the code people copy is exactly the code that gets checked.
//   node scripts/extract-blocks.mjs <skill> <out-folder>
// Languages: ts, tsx, js, jsx, mjs. A block is skipped when the line just above its opening fence is
// <!-- verify:skip --> (use it for fragments that can't stand alone, and say why in the skill's tests/README.md).
// Each file is named <source>-<n>.<ext>, e.g. SKILL-2.ts, recipes-5.tsx.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { SKILLS } from "./lib.mjs";

const EXT = { ts: "ts", typescript: "ts", tsx: "tsx", js: "js", javascript: "js", jsx: "jsx", mjs: "mjs" };

export function extract(skill, out) {
  const dir = join(SKILLS, skill), sources = [join(dir, "SKILL.md")];
  if (existsSync(join(dir, "references"))) for (const f of readdirSync(join(dir, "references")).sort()) if (f.endsWith(".md")) sources.push(join(dir, "references", f));
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const written = [];
  for (const src of sources) {
    const lines = readFileSync(src, "utf8").split("\n"), name = basename(src, ".md");
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
      const open = /^(\s*)```([A-Za-z]+)\s*$/.exec(lines[i]);
      if (!open) continue;
      const end = lines.findIndex((l, j) => j > i && /^\s*```\s*$/.test(l));
      if (end < 0) break;
      const ext = EXT[open[2].toLowerCase()], skip = /<!--\s*verify:skip\s*-->/.test(lines[i - 1] || "");
      if (ext && !skip) {
        n++;
        const file = join(out, `${name}-${n}.${ext}`);
        writeFileSync(file, lines.slice(i + 1, end).map((l) => l.slice(open[1].length)).join("\n") + "\n");
        written.push(file);
      }
      i = end;
    }
  }
  return written;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const [skill, out] = process.argv.slice(2);
  if (!skill || !out) { console.error("Usage: node scripts/extract-blocks.mjs <skill> <out-folder>"); process.exit(1); }
  const files = extract(skill, out);
  console.log(`${files.length} code blocks written to ${out}`);
}
