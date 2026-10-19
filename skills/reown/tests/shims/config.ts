// The Vite main.tsx blocks (quickstart.md, SKILL.md) do `import ... from './config'`; via "rootDirs" that resolves
// here, to the quickstart's own src/config.ts block. (The Next.js recipe's `@/config` and `@/context` are mapped to
// their blocks with "paths" in tsconfig.json.)
export * from '../blocks/quickstart-1';
