import { useState } from 'react';
import Head from 'next/head';
import { RedeemButton } from '../components/buttons/RedeemButton';

export default function InvestorPortal() {
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [noteId, setNoteId] = useState('1');
  const [amount, setAmount] = useState('100');

  return (
    <main className="relative min-h-screen bg-midnight px-6 py-12">
      <Head>
        <title>Investor Portal • Unified Sovereign Estate</title>
      </Head>
      {!ndaAccepted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-6">
          <div className="max-w-lg rounded-xl border border-white/10 bg-obsidian p-8 text-sm text-white shadow-neon">
            <h1 className="text-2xl font-semibold text-orchid">Sovereign NDA Acknowledgement</h1>
            <p className="mt-4 text-white/70">
              Access to the Investor Portal is contingent upon mutual acknowledgement of the Harvest Estate Non-Disclosure Accord. By proceeding you affirm fiduciary intent, confidentiality with respect to all documents presented, and adherence to tribal, ecclesiastical, and sovereign directives governing the Eklesia chain.
            </p>
            <button
              onClick={() => setNdaAccepted(true)}
              className="mt-6 w-full rounded-md bg-amethyst/80 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-neon transition hover:bg-amethyst"
            >
              Accept Accord & Enter
            </button>
          </div>
        </div>
      )}

      <section className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h2 className="text-2xl font-semibold text-orchid">Investor Operations</h2>
          <p className="mt-2 text-sm text-white/60">
            Review and redeem subscribed instruments, retrieve notarized Eyeion attestations, and evaluate distribution statuses.
          </p>
        </header>
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h3 className="text-lg font-semibold text-orchid">Redeem Matured Position</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs text-white/50">
              Note ID
              <input value={noteId} onChange={(e) => setNoteId(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
            <label className="text-xs text-white/50">
              Amount (HRVST)
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded bg-midnight/70 p-2 text-white" />
            </label>
          </div>
          <div className="mt-4">
            <RedeemButton noteId={BigInt(noteId || '0')} amount={BigInt(amount || '0') * 10n ** 18n} label="Redeem Allocation" />
          </div>
        </div>
      </section>
    </main>
  );
}
