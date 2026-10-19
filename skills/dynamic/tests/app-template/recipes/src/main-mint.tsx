// Harness: recipes.md #5 "write a contract" (MintButton) under the recipes.md #6 wagmi config built from
// customEvmNetworks with getOrMapViemChain.
import { createRoot } from 'react-dom/client';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './wagmi';
import { MintButton } from './recipes/mint';

createRoot(document.getElementById('root')!).render(
  <DynamicContextProvider
    settings={{ environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID, walletConnectors: [EthereumWalletConnectors] }}
  >
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={new QueryClient()}>
        <DynamicWagmiConnector>
          <MintButton address="0x0000000000000000000000000000000000000001" />
        </DynamicWagmiConnector>
      </QueryClientProvider>
    </WagmiProvider>
  </DynamicContextProvider>,
);
