// Harness: the skill's own vite.config.ts (copied to vite.skill.config.ts) with one HTML entry per build
// (ENTRY = index | wagmi | mint), so each page is bundled on its own like a normal single-page app.
import { mergeConfig } from 'vite';
import skill from './vite.skill.config';

const entry = process.env.ENTRY ?? 'index';
export default mergeConfig(skill, {
  build: { outDir: `dist/${entry}`, rollupOptions: { input: `${entry}.html` } },
});
