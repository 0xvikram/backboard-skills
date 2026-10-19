# AgentKit and the ETHGlobal Mumbai sponsor chains

**Short answer: AgentKit does not officially support any sponsor chain.** Its built-in network map has only Ethereum, Base, Polygon, Arbitrum, Optimism (mainnets and testnets) and Solana. CDP server wallets (`CdpEvmWalletProvider`, `CdpSmartWalletProvider`) and the faucet action don't work on World Chain, Unichain, Hedera, Arc, 0G or Whitechain.
Source: `network.ts` and `cdpEvmWalletProvider.ts` (`getCdpSdkNetwork`) at the 0.10.4 commit: https://github.com/coinbase/agentkit/tree/433bdc262038eca2bea923d87dc26f8fb76337d9/typescript/agentkit/src

**What works:** `ViemWalletProvider`, which the README calls "useful for interacting with any EVM-compatible chain", plus a private key you control. The create-onchain-agent scaffolder has a "Custom Chain ID" option that generates this setup. Code: [recipes.md #7](recipes.md#7-any-evm-chain-with-viemwalletprovider).
Source: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#viemwalletprovider

## Test results (19 Oct 2026, AgentKit 0.10.4, viem 2.38.3, no transactions sent)

| Chain | Chain ID (testnet) | viem 2.38.3 export | multicall3 in viem def | `get_wallet_details` via public RPC | Custom signing action |
|---|---|---|---|---|---|
| World Chain Sepolia | 4801 | `worldchainSepolia` | yes | OK (`worldchain-sepolia.g.alchemy.com/public`) | OK |
| Unichain Sepolia | 1301 | `unichainSepolia` | yes | OK (`sepolia.unichain.org`) | OK |
| Hedera Testnet | 296 | `hederaTestnet` | **no**, add it | OK (`testnet.hashio.io/api`) | OK |
| Arc Testnet | 5042002 | missing, use `defineChain` | add it | OK (`rpc.testnet.arc.io`); ERC-20 USDC balance OK with multicall3 | OK |
| 0G Galileo Testnet | **16602** | missing (`zeroGGalileoTestnet` 16601 is deprecated), use `defineChain` | add it | OK (`evmrpc-testnet.0g.ai`) | OK |
| Whitechain Sepolia | **1874** | missing (`whitechainTestnet` 2625 is outdated), use `defineChain` | add it | OK (`rpc.testnet.whitechain.io`) | OK |

Mainnet IDs: World Chain 480, Unichain 130, Hedera 295, Arc 5042, 0G 16661, Whitechain legacy L1 1875 (the Whitechain L2 mainnet isn't live). Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`) has code on all six testnets above (`eth_getCode`, 19 Oct 2026).

## What you lose off the native networks

- No CDP server wallet. You hold a raw private key (keep it in server env, test funds only).
- No `request_faucet_funds`. Use each chain's faucet (see the `sponsor-chains` skill).
- `getNetwork().networkId` is `undefined`, so providers that check it are dropped: weth, x402 and most DeFi providers (they target Base/Ethereum contracts anyway). `walletActionProvider`, `erc20ActionProvider`, `erc721ActionProvider`, `pythActionProvider` and your own actions still load.
- `get_wallet_details` and `native_transfer` always call the native token "ETH" (the label is hard-coded). On Arc it is really USDC, on Hedera HBAR, on 0G the 0G token, on Whitechain WBT. Say so in your agent's prompt.
- Hedera's JSON-RPC relay has EVM differences from Ethereum. Read the Hedera docs (or the `sponsor-chains` skill) before moving value there.

For RPCs, faucets, explorers and deeper chain facts: `npx skills add 0xvikram/backboard-skills --skill sponsor-chains`.
