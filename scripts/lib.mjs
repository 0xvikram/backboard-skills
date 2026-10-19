// Shared helpers for the repo scripts: find the skills and read their front matter. No dependencies.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;
export const SKILLS = join(ROOT, "skills");
export const GENERATED = "<!-- backboard:generated -->";

/** Every skill folder, sorted: [{ dir, path, text }] */
export function skills() {
  return readdirSync(SKILLS)
    .filter((d) => statSync(join(SKILLS, d)).isDirectory())
    .sort()
    .map((dir) => { const path = join(SKILLS, dir, "SKILL.md"); return { dir, path, text: existsSync(path) ? readFileSync(path, "utf8") : null }; });
}

const unquote = (v) => {
  v = v.trim();
  if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
};

/**
 * The YAML front matter of a SKILL.md, for the simple shape skills use: top-level `key: value` lines and one level of
 * `metadata:` with indented `key: value` lines. Returns { data, body } or null when there is no front matter.
 */
export function frontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text || "");
  if (!m) return null;
  const data = {};
  let block = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const kv = /^(\s*)([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, indent, key, value] = kv;
    if (indent && block) data[block][key] = unquote(value.replace(/\s+#.*$/, ""));
    else if (!value) { block = key; data[key] = {}; }
    else { block = null; data[key] = unquote(value); }
  }
  return { data, body: m[2] };
}

/** What the catalog shows for one skill. */
export function summary(s) {
  const fm = frontMatter(s.text) || { data: {}, body: "" };
  const d = fm.data, meta = d.metadata || {};
  const generated = s.text.includes(GENERATED);
  // generated skills quote the team's own one-liner; hand-written ones lead with a plain description
  const said = /its team describes it as: '([^']*)'/.exec(d.description || "");
  const what = (said ? said[1] : d.description || "").replace(/\s+/g, " ").trim();
  const title = (/^#\s+(.+)$/m.exec(fm.body) || [])[1] || s.dir;
  return { name: d.name || s.dir, title: title.trim(), what, category: meta.category || "", type: generated ? "Generated" : meta.source === "tested" ? "Tested" : "Hand-written", tested: meta.tested || "", mcp: /MCP server/i.test(fm.body) };
}
