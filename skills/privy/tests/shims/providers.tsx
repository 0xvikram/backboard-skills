// quickstart.md's layout block does `import Providers from './providers'`. With "rootDirs" this file sits next to
// the blocks, and it re-exports the quickstart's own providers block, so the layout is checked against the real thing.
export {default} from '../blocks/quickstart-1';
