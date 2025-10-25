import { useEffect, useMemo, useRef, useState } from 'react';
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
import { createNavTweener, type NavSnapshot as AnimatedSnapshot } from '../lib/navTweener';
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
  const [showToggleConfirm, setShowToggleConfirm] = useState(false);

  const [intakeDocs, setIntakeDocs] = useState(DEFAULT_DOCS);
  const [assetLabel, setAssetLabel] = useState('HASKINS-16315');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [cycleNoteId, setCycleNoteId] = useState('');
  const [redeemNoteId, setRedeemNoteId] = useState('');

  const [navSource, setNavSource] = useState<NavSnapshot | null>(null);
  const [navDisplay, setNavDisplay] = useState<AnimatedSnapshot | null>(null);
  const tweenerRef = useRef<((time: number) => AnimatedSnapshot) | null>(null);
  const rafRef = useRef<number>();

  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [panelState, setPanelState] = useState<Record<string, PanelState>>({});

  const modeColor =
    mode === 'demo'
      ? 'from-violet-900/70 to-indigo-900/60 border-violet-500/40'
      : 'from-amber-700/60 to-orange-600/40 border-amber-400/50';

  useEffect(() => {
    let mounted = true;

    const loadNav = async () => {
      try {
        const data = await fetchNav();
        if (!mounted) return;
        setNavSource(data);
        if (mode === 'live') {
          setNavDisplay(data);
        }
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

  useEffect(() => {
    if (!navSource) return;

    if (mode === 'live') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      tweenerRef.current = null;
      setNavDisplay(navSource);
      return;
    }

    tweenerRef.current = createNavTweener(navSource);

    const tick = () => {
      if (tweenerRef.current) {
        setNavDisplay(tweenerRef.current(performance.now()));
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, navSource]);

  const navMetrics = useMemo(() => {
    if (!navDisplay) return null;
    const coverage =
      (navDisplay.pools?.insured ?? 0) +
      (navDisplay.pools?.stable ?? 0) +
      (navDisplay.pools?.yield ?? 0);
    const navTotal = coverage - (navDisplay.pools?.liab ?? 0);
    const supply = navDisplay.pools?.supply ?? 0;

    return {
      navPerToken: navDisplay.navPerToken,
      policyFloor: navDisplay.floor,
      navTotal,
      supply,
    };
  }, [navDisplay]);

  const appendActivity = (entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, 10));
  };

  const handleIntakeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setPanelState((prev) => ({ ...prev, intake: 'loading' }));
      const response = await createIntake({ assetLabel, docs: intakeDocs });
      appendActivity({
        id: response.attestationId,
        label: `Intake recorded for ${assetLabel}`,
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      setPanelState((prev) => ({ ...prev, intake: 'success' }));
    } catch (error) {
      appendActivity({
        id: `intake-${Date.now()}`,
        label: 'Intake failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      setPanelState((prev) => ({ ...prev, intake: 'error' }));
    }
  };

  const handleInsuranceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setPanelState((prev) => ({ ...prev, insurance: 'loading' }));
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
      setPanelState((prev) => ({ ...prev, insurance: 'success' }));
    } catch (error) {
      appendActivity({
        id: `insurance-${Date.now()}`,
        label: 'Insurance binding failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      setPanelState((prev) => ({ ...prev, insurance: 'error' }));
    }
  };

  const handleMintSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setPanelState((prev) => ({ ...prev, mint: 'loading' }));
      const response = await createMint({
        instrument: formData.get('instrument')?.toString() === 'SDN' ? 'SDN' : 'CSDN',
        assetLabel: formData.get('assetLabel')?.toString() ?? assetLabel,
        par: formData.get('par')?.toString() ?? '0',
        affidavitId: formData.get('affidavitId')?.toString() || undefined,
        notes: formData.get('notes')?.toString() ?? undefined,
      });
      setNoteId(response.noteId);
      setCycleNoteId(response.noteId);
      setRedeemNoteId(response.noteId);
      appendActivity({
        id: response.attestationId,
        label: `Instrument issued (note ${response.noteId})`,
        status: 'success',
        attestationId: response.attestationId,
        ts: new Date(),
      });
      setPanelState((prev) => ({ ...prev, mint: 'success' }));
    } catch (error) {
      appendActivity({
        id: `mint-${Date.now()}`,
        label: 'Instrument issuance failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      setPanelState((prev) => ({ ...prev, mint: 'error' }));
    }
  };

  const handleCycleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setPanelState((prev) => ({ ...prev, cycle: 'loading' }));
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
      setPanelState((prev) => ({ ...prev, cycle: 'success' }));
    } catch (error) {
      appendActivity({
        id: `cycle-${Date.now()}`,
        label: 'Cycle execution failed',
        status: 'error',
        detail: error instanceof Error ? error.message : String(error),
        ts: new Date(),
      });
      setPanelState((prev) => ({ ...prev, cycle: 'error' }));
    }
  };

  const handleRedeemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      setPanelState((prev) => ({ ...prev, redeem: 'loading' }));
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
      setPanelState((prev) => ({ ...prev, redeem: '
