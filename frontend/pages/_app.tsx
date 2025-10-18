import type { AppProps } from 'next/app';
import Head from 'next/head';
import { WagmiConfig } from 'wagmi';
import { useEffect } from 'react';
import { wagmiConfig } from '../lib/wagmiClient';
import '../styles/globals.css';

export default function UnifiedEstateApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.body.classList.add('bg-midnight');
  }, []);

  return (
    <WagmiConfig config={wagmiConfig}>
      <Head>
        <title>Unified Sovereign Estate</title>
        <meta name="theme-color" content="#0b021f" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </WagmiConfig>
  );
}
