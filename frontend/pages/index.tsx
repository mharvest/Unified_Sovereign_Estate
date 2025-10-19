import { useMemo, useState } from 'react';
import { keccak256, parseUnits, stringToHex } from 'viem';
import { useAccount, useContractWrite } from 'wagmi';
import { FiduciaryConsole } from '../components/layout/FiduciaryConsole';
import FiduciaryConsoleApprovalPanel from '../components/panels/FiduciaryConsoleApprovalPanel';
import { CPAIssueButton } from '../components/buttons/CPAIssueButton';
import { UnderwriterInsureButton } from '../components/buttons/UnderwriterInsureButton';
import { TreasurySubscribeKYCButton } from '../components/buttons/TreasurySubscribeKYCButton';
import { TreasuryDistributeButton } from '../components/buttons/TreasuryDistributeButton';
import { RedeemButton } from '../components/buttons/RedeemButton';
import { csdnAbi, getCsdnAddress } from '../lib/csdn';
import { resolveWalletError } from '../lib/walletErrors';

export default function HomePage() {
  const [noteId, setNoteId] = useState('1');
  const [principal, setPrincipal] = useState('1000');
  const [docLabel, setDocLabel] = useState('Haskins Unit');
  const [coverAmount, setCoverAmount] = useState('1000');
  const [kycLeaf, setKycLeaf] = useState('');
  const [kycProof, setKycProof] = useState('');
  const [subscriberAddr, setSubscriberAddr] = useState('0x0000000000000000000000000000000000000000');
  const [distributionAmount, setDistributionAmount] = useState('1000');
  const [formError, setFormError] = useState<string | null>(null);
  const pauseWrite = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'pause'
  });
  const unpauseWrite = useContractWrite({
    address: getCsdnAddress(),
    abi: csdnAbi,
    functionName: 'unpause'
  });
  const { isConnected } = useAccount();

  const noteIdBig = useMemo(() => {
    try {
      return BigInt(noteId || '0');
    } catch {
      return 0n;
    }
  }, [noteId]);
  const principalBig = useMemo(() => {
    try {
      return parseUnits(principal || '0', 18);
    } catch {
      return 0n;
    }
  }, [principal]);
  const coverAmountBig = useMemo(() => {
    try {
      return parseUnits(coverAmount || '0', 18);
    } catch {
      return 0n;
    }
  }, [coverAmount]);
  const distributionAmountBig = useMemo(() => {
    try {
      return parseUnits(distributionAmount || '0', 18);
    } catch {
      return 0n;
    }
  }, [distributionAmount]);
  const docHash = useMemo(() => keccak256(stringToHex(docLabel || 'Document')), [docLabel]);
  const proofArray = useMemo(() =>
    kycProof
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean) as `0x${string}`[],
  [kycProof]);

  const pause = async () => {
    try {
      setFormError(null);
      if (!isConnected) {
        throw new Error('Connect a wallet to continue.');
      }
      if (!pauseWrite.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      await pauseWrite.writeAsync();
    } catch (err: any) {
      setFormError(resolveWalletError(err, 'Pause failed'));
    }
  };

  const unpause = async () => {
    try {
      setFormError(null);
      if (!isConnected) {
        throw new Error('Connect a wallet to continue.');
      }
      if (!unpauseWrite.writeAsync) {
        throw new Error('Wallet connection not ready');
      }
      await unpauseWrite.writeAsync();
    } catch (err: any) {
      setFormError(resolveWalletError(err, 'Resume failed'));
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <FiduciaryConsole>
        <div className="rounded-xl border border-white/10 bg-obsidian/60 p-5 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">CPA Panel</h2>
          <p className="mb-4 text-xs text-white/60">
            Originate and issue new CSDN notes. Provide a sovereign reference label to hash into the official document identifier.
          </p>
          <div className="space-y-3 text-xs">
            <label className="block text-white/50">
              Note Id
              <input value={noteId} onChange={(e) => setNoteId(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
            <label className="block text-white/50">
              Principal (HRVST)
              <input value={principal} onChange={(e) => setPrincipal(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
            <label className="block text-white/50">
              Document Label
              <input value={docLabel} onChange={(e) => setDocLabel(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
          </div>
          <div className="mt-4">
            <CPAIssueButton noteId={noteIdBig} docHash={docHash} principal={principalBig} />
            <p className="mt-2 text-[10px] text-white/40">Doc hash preview: {docHash}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-obsidian/60 p-5 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">Underwriter Panel</h2>
          <p className="mb-4 text-xs text-white/60">Price and bind risk coverage for the active note.</p>
          <label className="block text-xs text-white/50">
            Cover Amount (HRVST)
            <input value={coverAmount} onChange={(e) => setCoverAmount(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
          </label>
          <div className="mt-4">
            <UnderwriterInsureButton noteId={noteIdBig} coverAmount={coverAmountBig} />
          </div>
        </div>

       <div className="rounded-xl border border-white/10 bg-obsidian/60 p-5 shadow-neon">
         <h2 className="text-lg font-semibold text-orchid">Treasury Panel</h2>
          <p className="mb-4 text-xs text-white/60">Route compliant subscribers, mark distributions, and orchestrate redemptions.</p>
          <div className="space-y-3 text-xs">
            <label className="block text-white/50">
              Subscriber Address
              <input value={subscriberAddr} onChange={(e) => setSubscriberAddr(e.target.value as `0x${string}`)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
            <label className="block text-white/50">
              KYC Leaf (0x...)
             <input value={kycLeaf} onChange={(e) => setKycLeaf(e.target.value)} placeholder="0x..." className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
            <label className="block text-white/50">
              Merkle Proof (comma separated)
              <input value={kycProof} onChange={(e) => setKycProof(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
          </div>
          <div className="mt-4 space-y-4">
            <TreasurySubscribeKYCButton
              noteId={noteIdBig}
              lp={subscriberAddr as `0x${string}`}
              amount={principalBig}
              leaf={(kycLeaf || '0x0') as `0x${string}`}
              proof={proofArray}
            />
            <label className="block text-xs text-white/50">
              Distribution Amount (HRVST)
              <input value={distributionAmount} onChange={(e) => setDistributionAmount(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
            <TreasuryDistributeButton noteId={noteIdBig} lp={subscriberAddr as `0x${string}`} amount={distributionAmountBig} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-obsidian/60 p-5 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">Trustee & Investor Controls</h2>
          <p className="mb-4 text-xs text-white/60">Pause during audits or redeem matured positions directly from the console.</p>
         <div className="flex flex-col gap-3 text-xs">
           <button onClick={pause} className="rounded bg-rose-900/40 px-4 py-2 text-rose-200 transition hover:bg-rose-700/40">Pause Instrument</button>
           <button onClick={unpause} className="rounded bg-emerald-900/40 px-4 py-2 text-emerald-200 transition hover:bg-emerald-700/40">Resume Instrument</button>
           <RedeemButton noteId={noteIdBig} amount={distributionAmountBig} />
            {formError && <p className="text-[11px] text-rose-300">{formError}</p>}
          </div>
        </div>

        <FiduciaryConsoleApprovalPanel className="md:col-span-2" />
      </FiduciaryConsole>
    </main>
  );
}
