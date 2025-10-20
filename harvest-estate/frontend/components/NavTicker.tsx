import { useEffect, useRef, useState } from 'react';

type Snapshot = {
  ts: number;
  ok: boolean;
  navPerToken: number;
  floor: number;
  price: number;
};

const EKLESIA_URL = (process.env.NEXT_PUBLIC_EKLESIA_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export function NavTicker() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  const nav = snap?.navPerToken ?? 0;
  const floor = snap?.floor ?? 0;
  const price = snap?.price ?? 0;

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
