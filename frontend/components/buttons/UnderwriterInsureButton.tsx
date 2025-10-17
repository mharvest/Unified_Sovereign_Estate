import { useState } from 'react';
import { useContractWrite } from 'wagmi';
import { csdnAbi, getCsdnAddress } from '../../lib/csdn';

interface UnderwriterInsureButtonProps {
  noteId: bigint;
  coverAmount: bigint;
  label?: string;
}

export function UnderwriterInsureButton({ noteId, coverAmount, label = 'Bind Sovereign Cover' }: UnderwriterInsureButtonProps) {
  const insure = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'insure',
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
      if (!insure.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      if (coverAmount <= 0n) {
        throw new Error('Cover amount must be positive');
      }
      const result = await insure.writeAsync({ args: [noteId, coverAmount] });
      const hash = extractHash(result);
      if (hash) {
        setTxHash(hash);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to insure note');
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
        {pending ? 'Authorizing...' : label}
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
