import { useState } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import { isAddress, isHex } from 'viem';
import { Hex } from 'viem';
import { routerAbi, getRouterAddress } from '../../lib/router';
import { resolveWalletError } from '../../lib/walletErrors';

interface TreasurySubscribeKYCButtonProps {
  noteId: bigint;
  lp: `0x${string}`;
  amount: bigint;
  leaf: Hex;
  proof: Hex[];
  label?: string;
}

export function TreasurySubscribeKYCButton({ noteId, lp, amount, leaf, proof, label = 'KYC Subscribe' }: TreasurySubscribeKYCButtonProps) {
  const subscribe = useContractWrite({
    address: getRouterAddress(),
    abi: routerAbi,
    functionName: 'subscribeWithKyc',
    mode: 'recklesslyUnprepared'
  });
  const { isConnected } = useAccount();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const extractHash = (result: unknown) => {
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object' && 'hash' in result) {
      const value = (result as { hash?: unknown }).hash;
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  };

  const validateForm = () => {
    if (!isAddress(lp)) {
      throw new Error('Invalid subscriber address');
    }
    if (amount <= 0n) {
      throw new Error('Amount must be positive');
    }
    if (!isHex(leaf)) {
      throw new Error('Leaf must be a valid hex value');
    }
    proof.forEach((entry) => {
      if (!isHex(entry)) {
        throw new Error('All proof entries must be hex strings');
      }
    });
  };

  const handleClick = async () => {
    setError(null);
    setTxHash(null);
    try {
      validateForm();
      if (!isConnected) {
        throw new Error('Connect a wallet to continue.');
      }
      if (!subscribe.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      setPending(true);
      const result = await subscribe.writeAsync({ args: [noteId, lp, amount, leaf, proof] });
      const hash = extractHash(result);
      if (hash) {
        setTxHash(hash);
      }
    } catch (err: any) {
      setError(resolveWalletError(err, 'Subscription failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={pending}
        className="gradient-border w-full rounded-md bg-obsidian px-4 py-3 text-sm font-semibold uppercase tracking-wide shadow-neon transition hover:shadow-[0_0_25px_rgba(102,51,255,0.75)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Routing...' : label}
      </button>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!error && txHash && (
        <a
          href={`${process.env.NEXT_PUBLIC_EKLESIA_EXPLORER ?? '#'}tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-[10px] text-white/50 hover:text-orchid"
        >
          Last transaction: {txHash.slice(0, 10)}…
        </a>
      )}
    </div>
  );
}
