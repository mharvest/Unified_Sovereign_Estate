import { ReactNode, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useEvents } from '../../lib/hooks/useEvents';
import { useFiduciaryRole } from '../../lib/hooks/useFiduciaryRole';
import { EventFeed } from '../logs/EventFeed';

interface FiduciaryConsoleProps {
  children: ReactNode;
}

export function FiduciaryConsole({ children }: FiduciaryConsoleProps) {
  const [simulatorMode, setSimulatorMode] = useState(true);
  const events = useEvents(!simulatorMode);
  const { address, isConnected } = useAccount();
  const { roles, primaryRole } = useFiduciaryRole();

  const statusBadge = useMemo(() => {
    if (!isConnected) return 'Disconnected';
    if (simulatorMode) return 'Simulator Mode';
    return 'Live Mode';
  }, [isConnected, simulatorMode]);

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <header className="flex items-center justify-between rounded-xl border border-white/10 bg-obsidian/60 p-5 shadow-neon">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Unified Sovereign Estate</p>
            <h1 className="text-2xl font-semibold text-orchid">Fiduciary Command Console</h1>
            <p className="mt-2 text-xs text-white/60">
              {primaryRole ? `Active Role: ${primaryRole.replace('_ROLE', '')}` : 'No fiduciary role detected'}
            </p>
            {isConnected && address && <p className="text-[11px] text-white/40">Wallet {address}</p>}
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-widest text-white/40">Status</span>
            <div className="mt-1 rounded-full bg-amethyst/20 px-3 py-1 text-sm font-medium text-orchid shadow-neon">{statusBadge}</div>
            <button
              onClick={() => setSimulatorMode((prev) => !prev)}
              className="mt-4 rounded-full border border-white/10 bg-midnight px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-amethyst hover:text-white"
            >
              Toggle {simulatorMode ? 'Live Mode' : 'Simulator Mode'}
            </button>
          </div>
        </header>
        <section className="grid gap-4 md:grid-cols-2">
          {children}
        </section>
      </div>
      <aside>
        <EventFeed events={events} />
      </aside>
    </div>
  );
}
