// Sorts the extracted blocks: AssemblyScript mappings (compiled by `graph build`, not tsc) vs app code (tsc).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const BLOCKS = new URL("./blocks/", import.meta.url).pathname;
export const all = () => readdirSync(BLOCKS).sort().map((f) => ({ file: f, path: join(BLOCKS, f), code: readFileSync(join(BLOCKS, f), "utf8") }));
export const isMapping = (b) => /from\s+"(@graphprotocol\/graph-ts|\.\.\/generated\/[^"]+)"/.test(b.code);
