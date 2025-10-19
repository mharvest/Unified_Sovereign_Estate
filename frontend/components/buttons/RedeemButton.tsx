import { useState } from 'react';
import { useAccount, useContractWrite } from 'wagmi';
import { csdnAbi, getCsdnAddress } from '../../lib/csdn';
import { resolveWalletError } from '../../lib/walletErrors';

interface RedeemButtonProps {
  noteId: bigint;
  amount: bigint;
  label?: string;
}

export function RedeemButton({ noteId, amount, label = 'Redeem Note' }: RedeemButtonProps) {
  const redeem = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'redeem',
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

  const handleClick = async () => {
    try {
      setError(null);
      setTxHash(null);
      if (!isConnected) {
        setError('Connect a wallet to continue.');
        return;
      }
      setPending(true);
      if (!redeem.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      if (amount <= 0n) {
        throw new Error('Amount must be positive');
      }
      const result = await redeem.writeAsync({ args: [noteId, amount] });
      const hash = extractHash(result);
      if (hash) {
        setTxHash(hash);
      }
    } catch (err: any) {
      setError(resolveWalletError(err, 'Redeem failed'));
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
        {pending ? 'Processing...' : label}
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
