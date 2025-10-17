import { configureChains, createConfig } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { defineChain } from 'viem';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

export const eklesia = defineChain({
  id: Number(process.env.NEXT_PUBLIC_EKLESIA_CHAIN_ID ?? 777),
  name: 'Eklesia',
  network: 'eklesia',
  nativeCurrency: { name: 'HRVST', symbol: 'HRVST', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_EKLESIA_RPC ?? 'https://eklesia.example'] },
    public: { http: [process.env.NEXT_PUBLIC_EKLESIA_RPC ?? 'https://eklesia.example'] }
  }
});

const rpcUrl = eklesia.rpcUrls.default.http[0];

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [eklesia],
  [
    jsonRpcProvider({
      rpc: () => ({ http: rpcUrl })
    })
  ]
);

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo-project'
      }
    })
  ],
  publicClient,
  webSocketPublicClient
});
