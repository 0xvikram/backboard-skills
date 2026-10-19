<div align="center">

# Backboard skills

**Open-source AI skills for the developer tools hackers use at ETHGlobal Mumbai.**

Install one, and your AI coding assistant knows the tool's real docs, its MCP server, the chains it runs on and the mistakes to avoid.

[![Validate](https://github.com/0xvikram/backboard-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/0xvikram/backboard-skills/actions/workflows/ci.yml)
[![Verify](https://github.com/0xvikram/backboard-skills/actions/workflows/verify.yml/badge.svg)](https://github.com/0xvikram/backboard-skills/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-a8f20a)](LICENSE)
[![Skills format](https://img.shields.io/badge/format-Agent%20Skills-0b3b2d)](https://github.com/vercel-labs/skills)

[Board](https://backboard.0xvikram.me) · [Catalog](#catalog) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

---

## Quickstart

Run this in your project folder (Node 18 or later):

```bash
npx skills add 0xvikram/backboard-skills --skill privy
```

Then ask your assistant as usual, for example *"add email login with Privy"*. It reads the skill when the task matches.

```bash
# several tools at once
npx skills add 0xvikram/backboard-skills --skill privy --skill pimlico

# the Backboard guide: suggests tools for what you're building, from the live board
npx skills add 0xvikram/backboard-skills --skill backboard

# list every skill in this repo
npx skills add 0xvikram/backboard-skills --list

# install for one assistant only, across all your projects
npx skills add 0xvikram/backboard-skills --skill privy -a claude-code -g
```

Works with Claude Code, Cursor, Codex, OpenCode and [the other assistants the skills CLI supports](https://github.com/vercel-labs/skills#supported-agents). Every card on [the board](https://backboard.0xvikram.me) has an **Install skill** button that copies the right command.

## How it works

A skill is a folder with a `SKILL.md` file: short instructions plus reference files that an AI assistant loads only when your task needs them.

```text
skills/
  privy/
    SKILL.md              when to use it, quickstart, where to look next
    references/
      quickstart.md       setup, env vars, a complete example
      recipes.md          the things hackers build with it, with code
      errors.md           common errors and their fixes
      chains.md           sponsor chains it supports
```

There are two kinds:

| Kind | What it contains | How it's made |
| --- | --- | --- |
| **Tested** | Quickstart, recipes, errors, chain details, pinned versions | Written by hand from the official docs; every example is installed and type-checked or run before release |
| **Generated** | The tool's own docs, AI docs (llms.txt) and MCP server, plus its chains, prize-track fit and support links | Written automatically when a tool is approved on the board; contains no code, so it can't teach a wrong API |

Whatever the kind, the tool's official docs win over the skill when the two disagree.

## Verify a skill yourself

Every **Tested** skill ships with its checks in `skills/<tool>/tests/`, so you don't have to take our word for it. With Node 24 or later (what CI uses; Node 22 ships an npm 10 bug that breaks some installs):

```bash
git clone https://github.com/0xvikram/backboard-skills && cd backboard-skills
node scripts/verify.mjs privy          # install pinned packages, type-check every code block, run the live checks
node scripts/verify.mjs privy --full   # also build the real app the skill describes (e.g. next build)
node scripts/verify.mjs all            # every tested skill
```

The checks use no API keys, wallets or funds. Live checks only read from public services; anything that needs a key (real logins, transactions, deploys) is listed as not checked in each skill's `tests/README.md`. The same checks run in GitHub [twice a week](https://github.com/0xvikram/backboard-skills/actions/workflows/verify.yml), and an issue is opened when a skill breaks.

## Catalog

<!-- catalog:start -->
42 tool skills and 14 guide skills. **Tested** skills were written by hand and their examples run before release; **Generated** skills point your assistant at the tool's own docs, AI docs and MCP server.

**Guides**

| Skill | What it's for |
| --- | --- |
| [`backboard`](skills/backboard) | Use when hacking at ETHGlobal Mumbai (5 to 7 Nov 2026) and choosing SDKs, APIs or dev tools, or when the user says what they are building… |
| [`sponsor-chains`](skills/sponsor-chains) | Use when connecting to or deploying on World Chain, Unichain, Hedera, Arc, 0G or Whitechain (mainnet or testnet), for example at ETHGlobal… |
| [`track-0g`](skills/track-0g) | Use when building for the 0G prize track at ETHGlobal Mumbai (An L1 for decentralised AI apps). Lists the tools on Backboard that fit the… |
| [`track-1inch`](skills/track-1inch) | Use when building for the 1inch prize track at ETHGlobal Mumbai (Build an Aqua app: DeFi positions on Aqua and SwapVM). Lists the tools on… |
| [`track-arc`](skills/track-arc) | Use when building for the Arc prize track at ETHGlobal Mumbai (Apps built in Arc Studio: DeFi, payments and consumer agents). Lists the… |
| [`track-arkiv`](skills/track-arkiv) | Use when building for the Arkiv prize track at ETHGlobal Mumbai (Web3 databases with queryable records). Lists the tools on Backboard that… |
| [`track-chainlink`](skills/track-chainlink) | Use when building for the Chainlink prize track at ETHGlobal Mumbai (Workflows with CRE that connect chains to APIs, data and AI). Lists… |
| [`track-definitive`](skills/track-definitive) | Use when building for the Definitive prize track at ETHGlobal Mumbai (Flash API: advanced trade orders for social and agent apps). Lists… |
| [`track-ef`](skills/track-ef) | Use when building for the Ethereum Foundation prize track at ETHGlobal Mumbai (Privacy: Anon-RPC and private, censorship-resistant apps).… |
| [`track-ens`](skills/track-ens) | Use when building for the ENS prize track at ETHGlobal Mumbai (Names for wallets, apps and anything onchain). Lists the tools on Backboard… |
| [`track-hedera`](skills/track-hedera) | Use when building for the Hedera prize track at ETHGlobal Mumbai (AI agents that pay: x402 payments on Hedera). Lists the tools on… |
| [`track-uniswap`](skills/track-uniswap) | Use when building for the Uniswap Foundation prize track at ETHGlobal Mumbai (Uniswap v4, hooks and Unichain). Lists the tools on… |
| [`track-whitechain`](skills/track-whitechain) | Use when building for the Whitechain prize track at ETHGlobal Mumbai (Prize details not published yet). Lists the tools on Backboard that… |
| [`track-world`](skills/track-world) | Use when building for the World prize track at ETHGlobal Mumbai (Proof of personhood and apps for verified humans). Lists the tools on… |

**Tools**

| Skill | What it's for | Category | Type | MCP |
| --- | --- | --- | --- | --- |
| [`agentkit`](skills/agentkit) | Coinbase AgentKit gives an AI agent its own crypto wallet plus onchain tools (transfer,… | AI & agents | **Tested** 2026-10-19 | Yes |
| [`fetch-ai`](skills/fetch-ai) | A Python framework for agents that find and talk to each other | AI & agents | Generated |  |
| [`lit`](skills/lit) | Programmable keys and encryption for agents that hold secrets | AI & agents | Generated |  |
| [`olas`](skills/olas) | A framework for building and running autonomous agents | AI & agents | Generated |  |
| [`dune`](skills/dune) | Query onchain data with SQL and pull it into your app by API | Data & storage | Generated |  |
| [`envio`](skills/envio) | Envio HyperIndex (multichain EVM indexer: config.yaml, schema.graphql, TypeScript… | Data & storage | **Tested** 2026-10-19 | Yes |
| [`goldsky`](skills/goldsky) | Goldsky hosts subgraphs (GraphQL APIs over contract events, The Graph compatible) and… | Data & storage | **Tested** 2026-10-19 | Yes |
| [`pinata`](skills/pinata) | Upload files to IPFS with one API call | Data & storage | Generated | Yes |
| [`ponder`](skills/ponder) | A TypeScript-first indexer for small teams moving fast | Data & storage | Generated |  |
| [`the-graph`](skills/the-graph) | The Graph indexes smart-contract events into a GraphQL API (a subgraph). Use this skill… | Data & storage | **Tested** 2026-10-19 | Yes |
| [`aave`](skills/aave) | Lending markets to build yield, borrowing and agent strategies on | DeFi & trading | Generated | Yes |
| [`enso`](skills/enso) | One API to build multi-step DeFi actions | DeFi & trading | Generated |  |
| [`morpho`](skills/morpho) | Lending vaults and markets to plug yield or borrowing into your app | DeFi & trading | Generated |  |
| [`alchemy`](skills/alchemy) | Alchemy is RPC and data-API infrastructure for EVM chains (World Chain, Unichain, Arc,… | Dev infra & RPC | **Tested** 2026-10-19 | Yes |
| [`blockscout`](skills/blockscout) | An open-source explorer and APIs to verify contracts and show transactions | Dev infra & RPC | Generated |  |
| [`hardhat`](skills/hardhat) | The development environment for compiling, testing and deploying contracts | Dev infra & RPC | Generated |  |
| [`openzeppelin`](skills/openzeppelin) | Audited contract libraries to build your token, access control and upgrades on | Dev infra & RPC | Generated | Yes |
| [`quicknode`](skills/quicknode) | QuickNode is hosted RPC (HTTP + WebSocket) plus Streams, Webhooks and a testnet faucet… | Dev infra & RPC | **Tested** 2026-10-19 | Yes |
| [`scaffold-eth`](skills/scaffold-eth) | Scaffold-ETH 2 (create-eth) is a full-stack EVM dapp starter: Solidity (Hardhat or… | Dev infra & RPC | **Tested** 2026-10-19 | Yes |
| [`tenderly`](skills/tenderly) | Simulate and debug transactions, and test on virtual testnets | Dev infra & RPC | Generated |  |
| [`eas`](skills/eas) | Open attestations for reputation, credentials and proofs | Identity & humans | Generated |  |
| [`namespace-53d629`](skills/namespace-53d629) | Namespace issues ENS subnames (alice.yourapp.eth): gasless offchain subnames through an… | Identity & humans | **Tested** 2026-10-19 | Yes |
| [`reclaim`](skills/reclaim) | Let users prove data from any website without sharing their login | Identity & humans | Generated |  |
| [`sign`](skills/sign) | Issue and verify attestations across chains | Identity & humans | Generated |  |
| [`daimo`](skills/daimo) | Let users pay from any chain or coin in one step | Payments & stablecoins | Generated |  |
| [`onramp-money`](skills/onramp-money) | Onramp.money is a fiat-to-crypto on-ramp and off-ramp (INR via UPI/IMPS and 30+ other… | Payments & stablecoins | **Tested** 2026-10-19 |  |
| [`request`](skills/request) | Stablecoin invoices and payment requests | Payments & stablecoins | Generated |  |
| [`superfluid`](skills/superfluid) | Streaming payments for subscriptions, salaries and rewards | Payments & stablecoins | Generated |  |
| [`transak`](skills/transak) | A fiat on-ramp so users can pay with a card or bank transfer | Payments & stablecoins | Generated | Yes |
| [`livepeer`](skills/livepeer) | Video streaming and AI video pipelines | Social & messaging | Generated |  |
| [`neynar`](skills/neynar) | Farcaster APIs to add social features or ship a mini app | Social & messaging | Generated |  |
| [`push`](skills/push) | Wallet notifications and chat for your users | Social & messaging | Generated |  |
| [`xmtp`](skills/xmtp) | Wallet-to-wallet messaging for chat and agent apps | Social & messaging | Generated | Yes |
| [`biconomy`](skills/biconomy) | Gasless, one-click transactions across chains | Wallets & onboarding | Generated |  |
| [`dynamic`](skills/dynamic) | Dynamic (dynamic.xyz) wallet login for React: DynamicWidget sign-in with email, social… | Wallets & onboarding | **Tested** 2026-10-19 |  |
| [`pimlico`](skills/pimlico) | Pimlico is ERC-4337 account abstraction infra (bundler + paymaster) used with… | Wallets & onboarding | **Tested** 2026-10-19 | Yes |
| [`privy`](skills/privy) | Privy gives your app email/social/wallet login plus embedded wallets for every user, in… | Wallets & onboarding | **Tested** 2026-10-19 | Yes |
| [`reown`](skills/reown) | Reown AppKit (formerly WalletConnect Web3Modal): a connect-wallet modal for React,… | Wallets & onboarding | **Tested** 2026-10-19 |  |
| [`safe`](skills/safe) | Safe (Safe{Wallet}, formerly Gnosis Safe) is the standard multisig smart account, with… | Wallets & onboarding | **Tested** 2026-10-19 |  |
| [`thirdweb`](skills/thirdweb) | thirdweb TypeScript SDK v5 (`thirdweb` npm package): wallet connect UI, in-app wallets… | Wallets & onboarding | **Tested** 2026-10-19 | Yes |
| [`web3auth`](skills/web3auth) | Social login that creates a wallet for your users | Wallets & onboarding | Generated |  |
| [`zerodev`](skills/zerodev) | Smart accounts with session keys and gas sponsorship | Wallets & onboarding | Generated |  |

_This table is generated by `node scripts/catalog.mjs`. Don't edit it by hand._
<!-- catalog:end -->

## For tool teams

Your tool's skill is yours to improve: add your quickstart, the calls hackers need first and the errors they hit. See [CONTRIBUTING.md](CONTRIBUTING.md). Once you replace a generated skill with your own, Backboard never overwrites it.

Not listed yet? [List your tool on the board](https://backboard.0xvikram.me/?list=1). Its skill is published when it's approved.

## FAQ

**Is this official?** No. Backboard is an independent project by [Vikram](https://x.com/vikram_twt). It is not affiliated with, run by or endorsed by ETHGlobal, its sponsors or the tools listed here.

**Where are the prize rules?** Only on [ETHGlobal's prize page](https://ethglobal.com/events/mumbai/prizes). Skills link to it and never restate the rules.

**Is it safe to install?** Every change is reviewed and must pass [automated checks](scripts/validate.mjs): no piped install scripts, no secrets, no keys. Skills only tell your assistant how to use a tool; they don't run anything by themselves. Report anything suspicious through [SECURITY.md](SECURITY.md).

**A skill is wrong or out of date.** [Open an issue](https://github.com/0xvikram/backboard-skills/issues/new/choose) or send a pull request.

## License

[MIT](LICENSE). Tool names and trademarks belong to their owners.
