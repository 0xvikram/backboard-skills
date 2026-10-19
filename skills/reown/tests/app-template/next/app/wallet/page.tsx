'use client'
// Harness: renders the client recipes from recipes.md (#1 Wallet, #3 Buttons, #6 EmbeddedInfo, #8 Contract),
// copied into components/ by build-app.mjs.
import Wallet from '@/components/wallet'
import { Buttons } from '@/components/buttons'
import { EmbeddedInfo } from '@/components/embedded-info'
import { Contract } from '@/components/contract'

export default function WalletPage() {
  return (
    <div>
      <Wallet />
      <Buttons />
      <EmbeddedInfo />
      <Contract />
    </div>
  )
}
