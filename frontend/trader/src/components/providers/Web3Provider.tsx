'use client';

/**
 * Web3 provider wrapper for the on-site wallet-connect deposit flow.
 * Mounts wagmi + tanstack-query + RainbowKit only when needed (the modal
 * lazy-imports this file). Kept out of the global app/layout so the marketing
 * site, login pages, and the rest of the trader app don't pay the bundle
 * cost or the SDK init time on every page load.
 */
import { useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import '@rainbow-me/rainbowkit/styles.css';
import { getWagmiConfig } from '@/lib/web3/config';

export default function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Wallet metadata changes infrequently; tanstack default of 0s is
        // wasteful for this use case.
        staleTime: 30_000,
        retry: 1,
      },
    },
  }));
  const config = getWagmiConfig();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#d6a93d',
            accentColorForeground: '#1a1408',
            borderRadius: 'medium',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
