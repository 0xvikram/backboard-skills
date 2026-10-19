# Onramp.money and the ETHGlobal Mumbai sponsor chains

Onramp does not publish a sponsor-chain page. Everything below comes from its public config API and the live widget, checked on 19 Oct 2026. Support changes by coin, fiat currency and App ID, so check again before you build on it:

```
GET https://api.onramp.money/onramp/api/v3/buy/public/coinNetworks?coinCode=<coin>&fiatType=1
GET https://api.onramp.money/onramp/api/v2/sell/public/allConfig
```

| Chain | Onramp network code | What the API listed (buy, INR) | What the widget did | Status |
| - | - | - | - | - |
| World Chain | `wld` (Onramp id 10420, chainName "World Chain", explorer scan.worldcoin.group) | USDC and WLD list `wld`; sell `allConfig` lists `wld` for USDC and WLD | `coinCode=usdc&network=wld` (App ID 1): "Transactions are not available for the selected coin: USDC". `coinCode=wld&network=wld`: the address field asked for a "BEP20 network address" | **Listed, not confirmed working.** Ask Onramp. |
| Hedera | `hbar` (Onramp id 10052) | USDC and HBAR list `hbar`. The address must match `^0[.]0[.][1-9]\d{0,8}$`, so it is a Hedera account id (`0.0.x`), not an `0x` EVM address | not opened | Listed; not tested in the widget |
| Arc | `arc` (Onramp id 10569, chainName "ARC", no chain id given) | USDC lists `arc`, and so does sell `allConfig` | not opened | Listed. The API does not say whether this is Arc mainnet (5042) or testnet (5042002). Ask Onramp. |
| Unichain | none found | n/a | n/a | Not supported as far as the API shows |
| 0G | none found (`og` is the "OG Fan Token", not 0G) | n/a | n/a | Not supported as far as the API shows |
| Whitechain | none found | n/a | n/a | Not supported as far as the API shows |

Chain ids above (World Chain 480 / Sepolia 4801, Hedera 295 / testnet 296, Arc 5042 / testnet 5042002) are the ones Backboard verified. Onramp itself has no testnet for these chains; the only working sandbox pair found was USDT on `bep20-test`.

A pattern that works today: on-ramp INR to USDT on a supported network (`bep20`, `matic20`, `arbitrum`, `optimism`, ...) with Onramp, then bridge or swap to the sponsor chain in your app. Bridging is a separate integration that this skill does not cover.

For deeper chain facts (RPCs, explorers, faucets), install the `sponsor-chains` skill:
`npx skills add 0xvikram/backboard-skills --skill sponsor-chains`
