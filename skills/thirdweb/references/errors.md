# thirdweb errors and gotchas

"Reproduced" means I hit the error myself on 2026-10-19 with thirdweb@5.122.0.

## 1. `Module not found: Can't resolve '@x402/core/client'` (Next.js dev and build)

Also shows up for `@x402/evm`, `@x402/evm/exact/client` and `@x402/svm/exact/client`. The trace runs
`ConnectButton` → `wallets/base-account` → `@base-org/account` → `@coinbase/cdp-sdk`. `next dev` returns 500 and `next build` fails.
This happens with both Turbopack and `--webpack`.

- **Cause:** `@coinbase/cdp-sdk` (pulled in through thirdweb → `@base-org/account`) imports the `@x402/*` packages, but lists them as
  *optional* peer dependencies. npm does not install optional peers. Next's server (SSR) bundle tries to resolve them anyway.
  The `@x402` imports are in cdp-sdk 1.54.0 and later (checked up to 1.59.0, which is what installs today). The Vite browser build was fine.
- **Fix (tested):** `npm i @x402/core@2.28.0 @x402/evm@2.28.0 @x402/svm@2.28.0`. After that, dev returned 200 and build passed.
- Source: reproduced; peer list at https://www.npmjs.com/package/@coinbase/cdp-sdk (`peerDependenciesMeta`). This may be fixed
  upstream later. If a fresh install builds without these packages, you can drop them.

## 2. TS error: `{ clientId: string | undefined }` is not assignable to `CreateThirdwebClientOptions`

- **Cause:** `createThirdwebClient({ clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID })`. The option needs a `string`.
- **Fix:** check first, as the official next-starter does:
  `const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID; if (!clientId) throw new Error("...");`
- Source: reproduced; https://github.com/thirdweb-example/next-starter/blob/main/src/app/client.ts

## 3. `Type 'number' is not assignable to type 'bigint'`

- **Cause:** you passed `1` for a `uint256` param in `prepareContractCall` or `readContract`.
- **Fix:** pass bigints: `1n`, `BigInt(x)`, `toWei("0.1")` (from `thirdweb/utils`).
- Source: reproduced; examples in https://portal.thirdweb.com/references/typescript/v5/readContract use `params: [1n]`.

## 4. `getContract validation error - invalid address: 0x...`

- **Cause:** a placeholder address like `"0x..."` or `"0xYourContract"`. `getContract` checks the address when the module loads,
  so in Next.js it can break `next build` during prerender.
- **Fix:** use a real checksummed 0x address. Keep it in an env var and check that it is set.
- Source: reproduced during `next build`.

## 5. `401 Unauthorized` / RPC or wallet calls fail in the browser

- **Cause:** the Client ID's project does not list your domain in allowed domains (for example `localhost`, or your Vercel URL after
  you deploy). Or there is no key at all. Server code needs the Secret Key.
- **Fix:** dashboard → your project → settings → add the domain (`localhost`, `*.vercel.app`, ...). Use `secretKey` on servers and in scripts.
- Sources: https://portal.thirdweb.com/react/v5/getting-started (make a project "with `localhost` included in the allowed domains"),
  https://portal.thirdweb.com/typescript/v5/getting-started (Client ID vs Secret Key)

## 6. Transaction "does nothing" when clicked (React)

- **Cause:** `useSendTransaction().mutate` does not throw. Reverts, a wrong chain or no gas all end up in the hook's `error`.
- **Fix:** `const { mutate, error } = useSendTransaction();` and render `error?.message`, or pass `{ onError }`.
  Or use `<TransactionButton onError={...}>`, which also handles network switching.
- Source: https://github.com/thirdweb-dev/js/issues/3740

## 7. Wallet login breaks on `http://192.168.x.x:3000` or another non-https origin

- **Cause:** thirdweb wallets use browser crypto that only works on secure origins.
- **Fix:** develop on `http://localhost` or an https URL (a tunnel or a preview deploy).
- Source: https://portal.thirdweb.com/wallets/faq ("How do I troubleshoot unexpected console error messages?")

## 8. Sponsored gas works on testnet but not on mainnet / on some chains

- **Cause:** mainnet sponsorship needs a credit card on the account. Also, thirdweb's ERC-4337 bundler/paymaster is not enabled on
  every chain (for example Unichain, 0G, Hedera and Whitechain show `account-abstraction` disabled; see chains.md).
- **Fix:** add billing for mainnet, test on a testnet first, and check the chain's services before you pick it. Set spend limits under
  project → account abstraction → settings.
- Sources: https://portal.thirdweb.com/react/v5/in-app-wallet/enable-gasless, https://portal.thirdweb.com/wallets/sponsorship-policies,
  `https://api.thirdweb.com/v1/chains/<chainId>/services`

## 9. `npx thirdweb create app` exits with "command is deprecated"

- **Cause:** the docs still show it, but in thirdweb@5.122.0 the CLI prints "The 'thirdweb create' command is deprecated. Please use the
  thirdweb dashboard instead" and exits.
- **Fix:** use `create-next-app` or Vite (quickstart.md), or clone https://github.com/thirdweb-example/next-starter.
- Source: `node_modules/thirdweb/dist/esm/cli/bin.js` in thirdweb@5.122.0.

## 10. CLI `deploy` / `publish` asks for login or fails to link the device

- **Fix:** pass the secret key: `npx thirdweb@5.122.0 deploy -k "$THIRDWEB_SECRET_KEY"`. The CLI refuses `deploy`, `publish`, `upload`
  and `generate` without `-k`.
- Source: https://portal.thirdweb.com/knowledge-base/onchain-common-errors/thirdweb-cli/device-link-error

## 11. Copying v4 code from old tutorials

- **Cause:** v4 packages (`@thirdweb-dev/react`, `@thirdweb-dev/sdk`, `useContract`, `useContractWrite`, `ThirdwebSDK`) are a different API.
- **Fix:** use only the `thirdweb` package and v5 imports (`thirdweb`, `thirdweb/react`, `thirdweb/wallets`, `thirdweb/chains`, ...).
- Source: migration guide https://portal.thirdweb.com/react/v5/migrate
