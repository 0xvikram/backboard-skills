// Ambient names that fragments in the skill assume are already in scope.
import type { ThirdwebClient } from "thirdweb";
import type { Chain } from "thirdweb/chains";

declare global {
  // recipes.md "Read a contract" (one-off read) uses `client` and `baseSepolia` from the surrounding app.
  const client: ThirdwebClient;
  const baseSepolia: Chain;

  // quickstart.md (Vite): the skill tells users to type the env var in src/vite-env.d.ts like this;
  // vite/client normally supplies ImportMeta.env.
  interface ImportMetaEnv { readonly VITE_THIRDWEB_CLIENT_ID: string }
  interface ImportMeta { readonly env: ImportMetaEnv }
}
export {};
