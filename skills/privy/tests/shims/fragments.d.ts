// errors.md #1 is a two-line fix that uses `privy` and `accessToken` from recipes.md #6. These declarations give it
// the same types, so the fix (string argument, snake_case claims) is still checked against @privy-io/node.
import type {PrivyClient} from '@privy-io/node';
declare global {
  const privy: PrivyClient;
  const accessToken: string;
}
export {};
