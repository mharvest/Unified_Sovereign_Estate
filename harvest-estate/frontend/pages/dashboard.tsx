import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  createCycle,
  createInsurance,
  createIntake,
  createMint,
  createRedemption,
  fetchNav,
  fetchServiceHealth,
  type NavSnapshot,
  type ServiceHealth,
} from '../lib/api';
import { NavTicker } from '../components/NavTicker';
import { RedeemPanel } from '../components/RedeemPanel';
import { FiduciaryConsolePanel } from '../components/FiduciaryConsolePanel';
import { EyeionHashCard } from '../components/EyeionHashCard';

type Mode = 'demo' | 'live';
type PanelState = 'idle' | 'loading' | 'success' | 'error';

const JURISDICTION = 'UHMI 508(c)(1)(a); Cheroenhaka (Nottoway) Treaty 1713';

const DEFAULT_DOCS = [
  { type: 'APPRAISAL', hash: '0x721a90229d9d7d1899a75be9cfe6ea5e12a57cc1df4c92b6cf7ad79f0e1f58c7' },
  { type: 'TITLE/DEED', hash: '0x95817b41c98d36d864dbd31a73dec110f9701ce602757754f2300bc64a90f1c6' },
  { type: 'PAYOFF', hash: '0x3f731c6dca8535f6fcc61ab58f1395cce6aae1ec5d0d26e4eb3a630765860887' },
];

interface ActivityEntry {
  id: string;
  label: string;
  status: 'success' | 'error';
  attestationId?: string;
  detail?: string;
  ts: Date;
}

export default function Dashboard() {
  const [mode, setMode] = useState<Mode>('demo');
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  const [assetLabel, setAssetLabel] = useState('HASKINS-16315');
  const [cycleNoteId, setCycleNoteId] = useState('');
  const [redeemNoteId, setRedeemNoteId] = useState('');

  const [navSource, setNavSource] = useState<NavSnapshot | null>(null);

  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [panelState, setPanelState] = useState<Record<string, PanelState>>({});

  useEffect(() => {
    let mounted = true;

    const loadNav = async () => {
      try {
        const data = await fetchNav();
        if (!mounted) return;
        setNavSource(data);
      } catch (error) {
        console.error('Failed to fetch NAV', error);
      }
    };

    const loadHealth = async () => {
      try {
        const services = await fetchServiceHealth();
        if (!mounted) return;
        setHealth(services);
      } catch (error) {
        console.error('Failed to fetch health', error);
      }
    };

    loadNav();
    loadHealth();
    const navInterval = setInterval(loadNav, 10_000);
    const healthInterval = setInterval(loadHealth, 30_000);

    return () => {
      mounted = false;
      clearInterval(navInterval);
      clearInterval(healthInterval);
    };
  }, [mode]);

  const navMetrics = useMemo(() => {
    if (!navSource) return null;
    const coverage =
      (navSource.pools?.insured ?? 0) + (navSource.pools?.stable ?? 0) + (navSource.pools?.yield ?? 0);
    const navTotal = coverage - (navSource.pools?.liab ?? 0);
    const supply = navSource.pools?.supply ?? 0;

    return {
      navPerToken: navSource.navPerToken,
      policyFloor: navSource.floor,
      navTotal,
      supply,
      price: navSource.price,
    };
  }, [navSource]);

  const updatePanelState = (key: string, state: PanelState) => {
    setPanelState((prev) => ({ ...prev, [key]: state }));
    if (state === 'success' || state === 'error') {
      setTimeout(() => {
        setPanelState((prev) => {
          if (prev[key] !== state) return prev;
          const clone = { ...prev };
          delete clone[key];
          return clone;
        });
      }, 5000);
    }
  };

  const appendActivity = (entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, 12));
  };

  const handleModeToggle = () => {
    const nextMode: Mode = mode === 'demo' ? 'live' : 'demo';
    if (nextMode === 'live') {
      setPendingMode(nextMode);
    } else {
      setMode(nextMode);
      setPendingMode(null);
    }
  };

  const confirmModeToggle = () => {
    if (pendingMode) {
      setMode(pendingMode);
      setPendingMode(null);
    }
  };

  const cancelModeToggle = () => {
    setPendingMode(null);
  };

  const handleRedeemPanelModeChange = (next: Mode) => {
    if (next === mode) return;
    if (next === 'live') {
      setPendingMode('live');
    } else {
      setPendingMode(null);
      setMode('demo');
    }
  };

  const handleIntakeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePanelState('intake', 'loading');
    try {
      const response = await createIntake({ assetLabel, docs: DEFAULT_DOCS });
      appendActivity({
        id: response.attestationId,
        label: `Intake recorded for ${assetLabel}`,
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      updatePanelState('intake', 'success');
    } catch (error) {
      appendActivity({
        id: `intake-${Date.now()}`,
        label: 'Intake failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      updatePanelState('intake', 'error');
    }
  };

  const handleInsuranceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePanelState('insurance', 'loading');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await createInsurance({
        assetLabel: formData.get('assetLabel')?.toString() ?? assetLabel,
        classCode: Number(formData.get('classCode') ?? 1),
        factorBps: formData.get('factorBps')?.toString() ?? '7500',
        notes: formData.get('notes')?.toString() ?? undefined,
      });
      appendActivity({
        id: response.attestationId,
        label: 'Insurance coverage bound',
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      updatePanelState('insurance', 'success');
    } catch (error) {
      appendActivity({
        id: `insurance-${Date.now()}`,
        label: 'Insurance binding failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      updatePanelState('insurance', 'error');
    }
  };

  const handleMintSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePanelState('mint', 'loading');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await createMint({
        instrument: formData.get('instrument')?.toString() === 'SDN' ? 'SDN' : 'CSDN',
        assetLabel: formData.get('assetLabel')?.toString() ?? assetLabel,
        par: formData.get('par')?.toString() ?? '0',
        affidavitId: formData.get('affidavitId')?.toString() || undefined,
        notes: formData.get('notes')?.toString() ?? undefined,
      });
      setCycleNoteId(response.noteId);
      setRedeemNoteId(response.noteId);
      appendActivity({
        id: response.attestationId,
        label: `Instrument issued (note ${response.noteId})`,
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      updatePanelState('mint', 'success');
    } catch (error) {
      appendActivity({
        id: `mint-${Date.now()}`,
        label: 'Instrument issuance failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      updatePanelState('mint', 'error');
    }
  };

  const handleCycleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePanelState('cycle', 'loading');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await createCycle({
        noteId: formData.get('noteId')?.toString() || cycleNoteId,
        days: Number(formData.get('days') ?? 90),
        rateBps: Number(formData.get('rateBps') ?? 500),
        notes: formData.get('notes')?.toString() ?? undefined,
      });
      appendActivity({
        id: response.attestationId,
        label: 'Cycle executed',
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      updatePanelState('cycle', 'success');
    } catch (error) {
      appendActivity({
        id: `cycle-${Date.now()}`,
        label: 'Cycle execution failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      updatePanelState('cycle', 'error');
    }
  };

  const handleRedeemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePanelState('orchestratedRedeem', 'loading');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await createRedemption({
        noteId: formData.get('noteId')?.toString() || redeemNoteId,
        amount: formData.get('amount')?.toString() ?? '0',
        holder: formData.get('holder')?.toString() ?? undefined,
        notes: formData.get('notes')?.toString() ?? undefined,
      });
      appendActivity({
        id: response.attestationId,
        label: 'Redemption processed',
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      updatePanelState('orchestratedRedeem', 'success');
    } catch (error) {
      appendActivity({
        id: `redeem-${Date.now()}`,
        label: 'Redemption failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      updatePanelState('orchestratedRedeem', 'error');
    }
  };

  const renderPanelStatus = (key: string) => {
    const state = panelState[key];
    if (!state || state === 'idle') return null;
    const palette: Record<Exclude<PanelState, 'idle'>, string> = {
      loading: 'text-amber-300',
      success: 'text-emerald-300',
      error: 'text-rose-300',
    };
    const copy: Record<Exclude<PanelState, 'idle'>, string> = {
      loading: 'Processing request…',
      success: 'Success — attestation logged',
      error: 'Action failed — review activity log',
    };
    return <p className={`text-xs ${palette[state]}`}>{copy[state]}</p>;
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '—';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return '—';
    return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <>
      <Head>
        <title>Harvest Estate Fiduciary Console</title>
      </Head>
      <main className="min-h-screen bg-[#070013] px-6 py-10 text-gray-100">
        <section className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.4em] text-violet-400">Unified Sovereign Estate</div>
            <h1 className="mt-2 text-4xl font-semibold text-violet-100">Fiduciary Dashboard</h1>
            <p className="mt-3 max-w-xl text-sm text-gray-400">
              Lifecycle orchestration across intake, insurance binding, Se7en issuance, and Eyeion verification.
              Jurisdiction: <span className="text-violet-200">{JURISDICTION}</span>
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-violet-500/30 bg-violet-900/10 px-5 py-4 text-xs uppercase tracking-wide sm:items-end">
            <div className="flex items-center gap-3">
              <span className="text-gray-300">Simulation Mode</span>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  mode === 'live' ? 'bg-amber-400 text-black' : 'bg-violet-500/40 text-violet-100'
                }`}
              >
                {mode === 'live' ? 'Live' : 'Demo'}
              </span>
            </div>
            <button
              onClick={handleModeToggle}
              className="rounded-lg border border-violet-500/40 px-3 py-1 text-[11px] tracking-tight text-violet-200 transition hover:border-violet-300 hover:text-white"
            >
              {mode === 'demo' ? 'Promote to Live' : 'Return to Demo'}
            </button>
            {pendingMode && (
              <div className="max-w-xs rounded-lg border border-amber-400/50 bg-amber-800/30 px-3 py-2 text-[11px] text-amber-100">
                Live mode relays directly to Se7en orchestrator. Proceed?
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={confirmModeToggle}
                    className="rounded border border-amber-300 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/20"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={cancelModeToggle}
                    className="rounded border border-amber-300/40 px-2 py-1 text-[11px] text-amber-200 hover:border-amber-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-6xl space-y-8">
          <NavTicker />

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-violet-100">Asset Intake</h2>
                    {renderPanelStatus('intake')}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Registers appraisal attestations and SafeVault documents ahead of issuance.
                  </p>
                  <form onSubmit={handleIntakeSubmit} className="mt-4 space-y-4 text-sm">
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Asset Label</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        value={assetLabel}
                        onChange={(event) => setAssetLabel(event.target.value)}
                        required
                      />
                    </label>
                    <div>
                      <span className="text-xs uppercase tracking-wide text-gray-400">Seed Documents</span>
                      <ul className="mt-2 space-y-1 text-[11px] text-gray-300">
                        {DEFAULT_DOCS.map((doc) => (
                          <li key={doc.hash} className="rounded border border-white/5 bg-white/5 px-2 py-2 font-mono">
                            {doc.type}: {doc.hash.slice(0, 10)}…{doc.hash.slice(-6)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                      disabled={panelState.intake === 'loading'}
                    >
                      Record Intake
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-violet-100">Insurance Binding</h2>
                    {renderPanelStatus('insurance')}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Requests coverage corridors from the insurance desk with policy factors.
                  </p>
                  <form onSubmit={handleInsuranceSubmit} className="mt-4 space-y-4 text-sm">
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Asset Label</span>
                      <input
                        name="assetLabel"
                        value={assetLabel}
                        onChange={(event) => setAssetLabel(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Class Code</span>
                        <input
                          name="classCode"
                          type="number"
                          min={1}
                          defaultValue={2}
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Factor (bps)</span>
                        <input
                          name="factorBps"
                          type="number"
                          defaultValue={7500}
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
                      <textarea
                        name="notes"
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        placeholder="Optional coverage notes…"
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                      disabled={panelState.insurance === 'loading'}
                    >
                      Bind Coverage
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-violet-100">Se7en Issuance</h2>
                    {renderPanelStatus('mint')}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Mints CSDN/SDN instruments once covenants and insurance are recorded.
                  </p>
                  <form onSubmit={handleMintSubmit} className="mt-4 space-y-4 text-sm">
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Instrument</span>
                      <select
                        name="instrument"
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        defaultValue="CSDN"
                      >
                        <option value="CSDN">Collateralized Sovereign Debt Note</option>
                        <option value="SDN">Sovereign Debt Note</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Asset Label</span>
                      <input
                        name="assetLabel"
                        value={assetLabel}
                        onChange={(event) => setAssetLabel(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Par Amount (USD)</span>
                      <input
                        name="par"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue="1500000"
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Affidavit ID</span>
                      <input
                        name="affidavitId"
                        placeholder="Optional affidavit reference"
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
                      <textarea
                        name="notes"
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        placeholder="Optional issuance memo…"
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                      disabled={panelState.mint === 'loading'}
                    >
                      Issue Instrument
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-violet-100">Cycle & Redeem</h2>
                    {renderPanelStatus('cycle')}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Rolls accrued yield and schedules redemptions against the NAV floor.
                  </p>
                  <form onSubmit={handleCycleSubmit} className="mt-4 space-y-4 text-sm">
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Note Id</span>
                      <input
                        name="noteId"
                        value={cycleNoteId}
                        onChange={(event) => setCycleNoteId(event.target.value)}
                        placeholder="e.g. NOTE-001"
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        required
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Days</span>
                        <input
                          name="days"
                          type="number"
                          min="1"
                          defaultValue="90"
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Rate (bps)</span>
                        <input
                          name="rateBps"
                          type="number"
                          defaultValue="500"
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
                      <textarea
                        name="notes"
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        placeholder="Optional treasury memo…"
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                      disabled={panelState.cycle === 'loading'}
                    >
                      Execute Cycle
                    </button>
                  </form>

                  <div className="mt-6 border-t border-white/10 pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-violet-100">Treasury Redemption</h3>
                      {renderPanelStatus('orchestratedRedeem')}
                    </div>
                    <form onSubmit={handleRedeemSubmit} className="mt-3 space-y-3 text-sm">
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Note Id</span>
                        <input
                          name="noteId"
                          value={redeemNoteId}
                          onChange={(event) => setRedeemNoteId(event.target.value)}
                          placeholder="e.g. NOTE-001"
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Amount (HRVST)</span>
                        <input
                          name="amount"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="100"
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Holder</span>
                        <input
                          name="holder"
                          placeholder="Optional holder memo"
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
                        <textarea
                          name="notes"
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
                          placeholder="Optional redemption memo…"
                        />
                      </label>
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-gradient-to-r from-rose-500 via-fuchsia-600 to-purple-600 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                        disabled={panelState.orchestratedRedeem === 'loading'}
                      >
                        Process Redemption
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <RedeemPanel currentMode={mode} onModeChange={handleRedeemPanelModeChange} />
            </div>

            <div className="space-y-6">
              <EyeionHashCard />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                <h2 className="text-lg font-semibold text-violet-100">Coverage Snapshot</h2>
                <dl className="mt-4 space-y-3 text-sm text-gray-200">
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">NAV / Token</dt>
                    <dd className="font-mono text-base text-white">
                      {navMetrics ? `$${navMetrics.navPerToken.toFixed(4)}` : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Policy Floor</dt>
                    <dd className="font-mono text-base text-white">
                      {navMetrics ? `$${navMetrics.policyFloor.toFixed(4)}` : '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Coverage NAV</dt>
                    <dd className="font-mono text-base text-white">{formatCurrency(navMetrics?.navTotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Outstanding Supply</dt>
                    <dd className="font-mono text-base text-white">{formatNumber(navMetrics?.supply)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">Reference Price</dt>
                    <dd className="font-mono text-base text-white">
                      {navMetrics ? `$${navMetrics.price.toFixed(4)}` : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
              <FiduciaryConsolePanel />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                <h2 className="text-lg font-semibold text-violet-100">Activity Feed</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {activity.length === 0 && (
                    <li className="text-xs text-gray-400">No activity recorded yet. Execute an action to populate the ledger.</li>
                  )}
                  {activity.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-white/10 bg-white/10 px-4 py-3"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                        <span className={entry.status === 'success' ? 'text-emerald-300' : 'text-rose-300'}>
                          {entry.status === 'success' ? 'Success' : 'Error'}
                        </span>
                        <span className="text-gray-400">{entry.ts.toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-100">{entry.label}</p>
                      {entry.attestationId && (
                        <p className="mt-1 text-[11px] font-mono text-gray-400">
                          Attestation: {entry.attestationId.slice(0, 8)}…{entry.attestationId.slice(-6)}
                        </p>
                      )}
                      {entry.detail && (
                        <p className="mt-1 text-[11px] text-rose-200/80">Detail: {entry.detail}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
                <h2 className="text-lg font-semibold text-violet-100">Service Health</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {health.length === 0 && (
                    <li className="text-xs text-gray-400">Pinging orchestrator services…</li>
                  )}
                  {health.map((svc) => (
                    <li key={svc.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/10 px-4 py-3">
                      <span className="text-gray-200 uppercase tracking-wide">{svc.name}</span>
                      <span
                        className={`text-xs font-semibold uppercase ${
                          svc.healthy ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {svc.healthy ? 'ONLINE' : 'ISSUE'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
