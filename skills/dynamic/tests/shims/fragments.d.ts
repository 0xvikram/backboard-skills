// SKILL.md step 4 is the one-line `export default defineConfig(...)` from quickstart.md's vite.config.ts, without
// its imports. These declarations give it the same names, so it is still checked against Vite's types.
declare global {
  const defineConfig: typeof import('vite').defineConfig;
  const react: typeof import('@vitejs/plugin-react').default;
}
export {};
