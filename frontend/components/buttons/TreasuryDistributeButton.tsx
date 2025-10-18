import { useState } from 'react';
import { useContractWrite } from 'wagmi';
import { isAddress } from 'viem';
import { csdnAbi, getCsdnAddress } from '../../lib/csdn';

interface TreasuryDistributeButtonProps {
  noteId: bigint;
  lp: `0x${string}`;
  amount: bigint;
  label?: string;
}

export function TreasuryDistributeButton({ noteId, lp, amount, label = 'Mark Distribution' }: TreasuryDistributeButtonProps) {
  const markDistribution = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'markDistribution',
    mode: 'recklesslyUnprepared'
  });
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

  const handleClick = async () => {
    try {
      setPending(true);
      setError(null);
      if (!markDistribution.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      if (!isAddress(lp)) {
        throw new Error('Invalid subscriber address');
      }
      if (amount <= 0n) {
        throw new Error('Amount must be positive');
      }
      const result = await markDistribution.writeAsync({ args: [noteId, lp, amount] });
      const hash = extractHash(result);
      if (hash) {
        setTxHash(hash);
      }
    } catch (err: any) {
      setError(err.message ?? 'Distribution failed');
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
        {pending ? 'Updating...' : label}
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
