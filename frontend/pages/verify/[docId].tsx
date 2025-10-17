import { useRouter } from 'next/router';
import useSWR from 'swr';
import Head from 'next/head';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function VerifyDocument() {
  const router = useRouter();
  const { docId } = router.query as { docId?: string };
  const eyeionBase = process.env.NEXT_PUBLIC_EYEION_API ?? '';
  const { data, error, isLoading } = useSWR(() => (docId ? `${eyeionBase}/records/${docId}` : null), fetcher);

  return (
    <main className="min-h-screen bg-midnight px-6 py-12 text-white">
      <Head>
        <title>Verify Document • Unified Estate</title>
      </Head>
      <section className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h1 className="text-2xl font-semibold text-orchid">Eyeion Verification</h1>
          <p className="mt-2 text-sm text-white/60">Document hash lineage, oracle attestations, and SafeVault anchors.</p>
        </header>
        <article className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          {!docId && <p className="text-sm text-white/50">Provide a document id to begin verification.</p>}
          {docId && isLoading && <p className="text-sm text-white/50">Loading Eyeion attestation trail...</p>}
          {error && <p className="text-sm text-rose-300">Unable to load verification feed.</p>}
          {data && (
            <div className="space-y-3 text-xs text-white/80">
              <div>
                <span className="text-white/40">Document Hash</span>
                <p className="font-mono text-sm text-amethyst">{data.docHash}</p>
              </div>
              <div>
                <span className="text-white/40">Current State</span>
                <p>{data.status}</p>
              </div>
              <div>
                <span className="text-white/40">Attestations</span>
                <ul className="mt-2 space-y-2">
                  {(data.history ?? []).map((entry: any) => (
                    <li key={entry.txHash} className="rounded border border-white/5 bg-midnight/60 p-3">
                      <p className="text-amethyst">{entry.event}</p>
                      <p className="text-white/60">Block {entry.blockNumber}</p>
                      <a href={`${process.env.NEXT_PUBLIC_EKLESIA_EXPLORER ?? '#'}tx/${entry.txHash}`} target="_blank" rel="noreferrer" className="text-[10px] text-orchid hover:text-white">
                        View transaction
                      </a>
                      {entry.ipfs?.cid && (
                        <p className="mt-1 text-[10px] text-white/50">IPFS bundle: {entry.ipfs.cid}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
