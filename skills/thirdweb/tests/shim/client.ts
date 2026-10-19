// Stands in for the user's src/app/client.ts, so blocks that do `import { client } from "./client"` resolve
// (tsconfig "rootDirs" merges shim/ with blocks/). Same code as the skill's client.ts.
import { createThirdwebClient } from "thirdweb";
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
if (!clientId) throw new Error("Set NEXT_PUBLIC_THIRDWEB_CLIENT_ID in .env.local");
export const client = createThirdwebClient({ clientId });
