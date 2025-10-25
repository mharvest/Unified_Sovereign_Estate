import useSWR from 'swr';

const EKLESIA_URL = (process.env.NEXT_PUBLIC_EKLESIA_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function EyeionHashCard() {
  const { data } = useSWR(`${EKLESIA_URL}/api/nav`, fetcher, { refreshInterval: 8000 });
  const hash = data?.eyeionHash || 'pending attestation';

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/10 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-emerald-200">Eyeion Verification Hash</h2>
      <p className="mt-3 break-all font-mono text-xs text-emerald-100/80">
        {hash}
      </p>
      <p className="mt-2 text-[11px] text-emerald-200/70">
        Hash refreshed with every redemption journal; mirror to Eyeion ledger for auditor cross-check.
      </p>
    </div>
  );
}
