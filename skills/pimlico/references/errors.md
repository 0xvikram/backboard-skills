# Pimlico errors and gotchas

Full lists: bundler error codes https://docs.pimlico.io/references/bundler/bundler-error-codes , EntryPoint `AAxx` errors https://docs.pimlico.io/references/bundler/entrypoint-errors

## 1. `invalid 'apikey' query parameter` / `missing 'apikey' query parameter`
The key in the URL is wrong, deleted, or `process.env.PIMLICO_API_KEY` is `undefined` (URL ends in `apikey=undefined`).
Fix: load `.env` (`import "dotenv/config"` as the first import), check the key on https://dashboard.pimlico.io/apikeys , or make a new one.
Source: https://docs.pimlico.io/references/bundler/bundler-errors/invalid-api-key

## 2. `Smart Account does not have sufficient funds to execute the User Operation` / `AA21 didn't pay prefund`
No paymaster was used, and the smart account has no native gas. Usually `paymaster: pimlicoClient` is missing from `createSmartAccountClient` (or from the call).
Fix: add `paymaster: pimlicoClient` to sponsor, or send native gas to `account.address` (the smart account, not the owner EOA). Seen in our test on Sepolia, World Chain Sepolia, Unichain Sepolia and Arc Testnet when the paymaster was left out.
Source: https://docs.pimlico.io/references/bundler/entrypoint-errors/aa21

## 3. `Sponsorship policy ID is required for this API key`
The key (or endpoint) only sponsors user operations tied to a policy. We got this from the keyless public endpoint `public.pimlico.io`.
Fix: use your own API key, or create a policy and pass `paymasterContext: { sponsorshipPolicyId: "<POLICY_ID>" }` (recipes.md #6). Check the key's settings on the API Keys page.
Source: https://docs.pimlico.io/references/bundler/public-endpoint , https://docs.pimlico.io/guides/how-to/security/protect-api-keys

## 4. Account address is `0x0000000000000000000000000000000000000000` / `Failed to simulate deployment for Smart Account`
The account factory for that type and version is not deployed on this chain. We hit it with `toKernelSmartAccount({ version: "0.3.1" })` on World Chain Sepolia.
Fix: use Safe 1.4.1 or Simple Account, or a Kernel version listed for that chain in https://docs.pimlico.io/guides/supported-chains . Also: Kernel `0.2.x` only works with EntryPoint 0.6 and `0.3.x` only with 0.7 ([reference](https://docs.pimlico.io/references/permissionless/reference/accounts/toKernelSmartAccount)).

## 5. `Insufficient Pimlico balance for sponsorship, please top up`
You are sponsoring on a mainnet. Testnets are free; mainnets need a Pimlico balance.
Fix: stay on testnets for the hackathon, or top up in the dashboard.
Source: https://docs.pimlico.io/references/paymaster/verifying-paymaster/common-errors

## 6. `chain XYZ is not supported`
The chain ID or slug in the URL is not on Pimlico's list (e.g. Hedera, 0G, Whitechain are not listed as of 2026-10-19), or the slug is misspelled.
Fix: use the numeric chain ID in the URL (`https://api.pimlico.io/v2/4801/rpc?...`) and check https://docs.pimlico.io/guides/supported-chains
Source: https://docs.pimlico.io/references/bundler/bundler-errors/chain-not-supported

## 7. `AA25 invalid account nonce`
Two user operations from the same account with the same nonce (e.g. you fired several sends in parallel, or reused a prepared op).
Fix: send one at a time and `await` each, or use different nonce keys for parallel sends ([guide](https://docs.pimlico.io/references/permissionless/how-to/parallel-transactions)).
Source: https://docs.pimlico.io/references/bundler/entrypoint-errors/aa25

## 8. `WaitForUserOperationReceiptTimeoutError`
The op is not mined before the client stops waiting (slow chain or busy bundler).
Fix: raise the timeout: `bundlerTransport: http(pimlicoUrl, { timeout: 30_000 })`, or use `sendUserOperation` + `waitForUserOperationReceipt({ hash, timeout: 120_000 })`. Check status with `pimlico_getUserOperationStatus`.
Source: https://docs.pimlico.io/references/permissionless/faqs , https://docs.pimlico.io/references/bundler/faqs

## 9. `preVerificationGas is not enough` / out of gas
The estimate went stale (the bundler holds its `preVerificationGas` estimate for 30 seconds), or a custom signer gives a dummy signature of the wrong length.
Fix: send right after preparing. If it still fails, set limits yourself in `prepareUserOperation({ calls, callGasLimit, verificationGasLimit, preVerificationGas })`.
Source: https://docs.pimlico.io/references/permissionless/faqs

## 10. Address changed / "my funds are gone"
Counterfactual addresses depend on owner, account type, version and salt (`saltNonce` for Safe, `index` for Kernel). A new random owner key on each run (e.g. `generatePrivateKey()` without saving) gives a new empty account each time.
Fix: save the owner key once (quickstart writes it to `.env`), keep salt and version fixed. Note: the official tutorial's `writeFileSync(".env", ...)` replaces the whole `.env` file and removes your API key line; append instead.
Source: https://docs.pimlico.io/references/permissionless/faqs (saltNonce section)

## 11. Old v0.1 code from blog posts or older AI answers
`ENTRYPOINT_ADDRESS_V07`, `createBundlerClient` from permissionless, `sponsorUserOperation:` middleware and `bundlerClient.sendUserOperation({ userOperation })` are the old permissionless v0.1 API. They do not exist in 0.5.0.
Fix: use `entryPoint07Address` from `viem/account-abstraction`, `paymaster: pimlicoClient`, and `smartAccountClient.sendTransaction` / `sendUserOperation({ calls })` as in this skill. Migration notes: https://docs.pimlico.io/references/permissionless/how-to/migration-guide
