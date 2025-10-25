import { useEffect, useRef, useState } from 'react';

type Snapshot = {
  ts: number;
  ok: boolean;
  navPerToken: number;
  floor: number;
  price: number;
};

const EKLESIA_URL = (process.env.NEXT_PUBLIC_EKLESIA_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const DEFAULT_SNAPSHOT: Snapshot = {
  ts: Date.now(),
  ok: false,
  navPerToken: 1,
  floor: 0.99,
  price: 1.01,
};

export function NavTicker() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [displaySnap, setDisplaySnap] = useState<Snapshot>(DEFAULT_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const baseSnapRef = useRef<Snapshot>(DEFAULT_SNAPSHOT);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const source = new EventSource(`${EKLESIA_URL}/api/nav/preview`);
    eventSourceRef.current = source;
    source.onopen = () => setConnected(true);
    source.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        setSnap(data);
      } catch (error) {
        console.error('nav sse parse error', error);
      }
    };
    source.onerror = () => {
      setConnected(false);
      source.close();
    };
    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (connected) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${EKLESIA_URL}/api/nav`, { cache: 'no-store' });
        const data = await res.json();
        setSnap(data);
      } catch (error) {
        console.error('nav polling error', error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    if (!snap) return;
    baseSnapRef.current = snap;
  }, [snap]);

  useEffect(() => {
    const baseFrequencyMs = 8000;
    const update = (time: number) => {
      if (startTimeRef.current === 0) {
        startTimeRef.current = time;
      }
      const base = baseSnapRef.current;
      const phase = ((time - startTimeRef.current) % baseFrequencyMs) / baseFrequencyMs * Math.PI * 2;
      const wobble = (value: number, ratio: number, minimum: number, offset: number) => {
        const amplitude = Math.max(Math.abs(value) * ratio, minimum);
        return value + amplitude * Math.sin(phase + offset);
      };

      const next: Snapshot = {
        ...base,
        navPerToken: wobble(base.navPerToken, 0.015, 0.0005, 0),
        floor: wobble(base.floor, 0.012, 0.0004, Math.PI / 2),
        price: wobble(base.price, 0.02, 0.0006, Math.PI),
      };

      setDisplaySnap(next);
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const nav = displaySnap.navPerToken;
  const floor = displaySnap.floor;
  const price = displaySnap.price;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-900/60 via-purple-900/40 to-indigo-950/60 shadow-lg">
      <div className="flex items-center justify-between px-6 py-4 text-sm font-mono uppercase tracking-wide">
        <div className="flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-ping'}`}
          />
          <span className="text-violet-200">HRVST NAV Ticker</span>
        </div>
        <div className="flex items-center gap-6 text-violet-100">
          <span>NAV ${nav.toFixed(4)}</span>
          <span>Floor ${floor.toFixed(4)}</span>
          <span className="text-fuchsia-200">Price ${price.toFixed(4)}</span>
        </div>
      </div>
      <div className="h-[2px] w-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-500" />
    </div>
  );
}
