import Head from 'next/head';
import { useMemo } from 'react';
import useSWR from 'swr';
import { FiduciaryConsole } from '../components/layout/FiduciaryConsole';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminDashboard() {
  const analyticsBase = process.env.NEXT_PUBLIC_ANALYTICS_API ?? '';
  const { data } = useSWR(() => (analyticsBase ? `${analyticsBase}/estate/metrics` : null), fetcher, { suspense: false });

  const metrics = useMemo(() => ({
    activeNotes: data?.activeNotes ?? 0,
    insuredValue: data?.insuredValue ?? '0',
    subscribers: data?.subscribers ?? 0,
    vaults: data?.vaults ?? 0,
    oracleLatency: data?.oracleLatency ?? '—'
  }), [data]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Head>
        <title>Admin Dashboard • Unified Estate</title>
      </Head>
      <FiduciaryConsole>
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">Network Metrics</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm text-white/70">
            <div><dt className="text-white/40">Active Notes</dt><dd className="text-xl font-semibold text-white">{metrics.activeNotes}</dd></div>
            <div><dt className="text-white/40">Insured Value</dt><dd className="text-xl font-semibold text-white">{metrics.insuredValue}</dd></div>
            <div><dt className="text-white/40">Subscribers</dt><dd className="text-xl font-semibold text-white">{metrics.subscribers}</dd></div>
            <div><dt className="text-white/40">Verified Vaults</dt><dd className="text-xl font-semibold text-white">{metrics.vaults}</dd></div>
            <div><dt className="text-white/40">Oracle Latency</dt><dd className="text-xl font-semibold text-white">{metrics.oracleLatency}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">Governance Actions</h2>
          <p className="mt-2 text-xs text-white/60">Track proposals queued via EstateGovernor and confirm timelock execution status.</p>
          <div className="mt-4 space-y-3 text-xs">
            <p className="flex items-center justify-between rounded bg-midnight/70 p-3">
              <span className="text-white/50">Next Execution Window</span>
              <span className="text-white">{data?.nextWindow ?? 'Pending'}</span>
            </p>
            <p className="flex items-center justify-between rounded bg-midnight/70 p-3">
              <span className="text-white/50">Queued Proposals</span>
              <span className="text-white">{data?.queuedProposals ?? 0}</span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">Automation (Se7en)</h2>
          <p className="text-xs text-white/60">Latest orchestrated tasks and AI-assigned fiduciary directives.</p>
          <ul className="mt-4 space-y-2 text-xs">
            {(data?.tasks ?? []).map((task: any) => (
              <li key={task.id} className="rounded border border-white/5 bg-midnight/70 p-3">
                <p className="text-amethyst">{task.title}</p>
                <p className="text-white/60">{task.status}</p>
              </li>
            ))}
            {(!data?.tasks || data.tasks.length === 0) && <li className="text-white/40">Automation queue is clear.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6 shadow-neon">
          <h2 className="text-lg font-semibold text-orchid">Security Signals</h2>
          <p className="text-xs text-white/60">Daily SafeVault attestations, KYC root rotations, and oracle health state.</p>
          <ul className="mt-4 space-y-2 text-xs text-white/70">
            {(data?.security ?? []).map((entry: any) => (
              <li key={entry.timestamp} className="rounded border border-white/5 bg-midnight/70 p-3">
                <p className="text-amethyst">{entry.message}</p>
                <p className="text-white/50">{entry.timestamp}</p>
              </li>
            ))}
            {(!data?.security || data.security.length === 0) && <li className="text-white/40">No outstanding security notices.</li>}
          </ul>
        </div>
      </FiduciaryConsole>
    </main>
  );
}
