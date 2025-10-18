import { useState } from 'react';
import { useContractWrite } from 'wagmi';
import { Hex } from 'viem';
import { csdnAbi, getCsdnAddress } from '../../lib/csdn';

interface CPAIssueButtonProps {
  noteId: bigint;
  docHash: Hex;
  principal: bigint;
  label?: string;
}

export function CPAIssueButton({ noteId, docHash, principal, label = 'Originate & Issue' }: CPAIssueButtonProps) {
  const originate = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'originate',
    mode: 'recklesslyUnprepared'
  });
  const issue = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'issue',
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
      if (!originate.writeAsync || !issue.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      if (principal <= 0n) {
        throw new Error('Principal must be positive');
      }
      const originateTx = await originate.writeAsync({ args: [noteId, docHash, principal] });
      const originateHash = extractHash(originateTx);
      if (originateHash) {
        setTxHash(originateHash);
      }
      const issueTx = await issue.writeAsync({ args: [noteId] });
      const issueHash = extractHash(issueTx);
      if (issueHash) {
        setTxHash(issueHash);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to originate note');
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
        {pending ? 'Submitting...' : label}
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
