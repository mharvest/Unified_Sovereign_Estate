import { FormEvent, useState } from 'react';

interface RedeemPanelProps {
  currentMode: 'demo' | 'live';
  onModeChange: (mode: 'demo' | 'live') => void;
}

export function RedeemPanel({ currentMode, onModeChange }: RedeemPanelProps) {
  const [holderId, setHolderId] = useState('');
  const [tokens, setTokens] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(evt: FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holderId, tokens: Number(tokens) }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'redemption_failed');
      }
      setResult(
        `Redemption ticket #${json.ticket.id} | Holder ${json.ticket.holderId} | USD ${json.usdOwed.toFixed(
          2,
        )} @ $${json.price.toFixed(4)}`,
      );
      setHolderId('');
      setTokens('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    } finally {
      setLoading(false);
    }
  }

  const handleToggle = () => {
    onModeChange(currentMode === 'demo' ? 'live' : 'demo');
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 p-6 shadow-lg">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs uppercase tracking-wide text-gray-400">
        <div>
          <h2 className="text-lg font-semibold text-violet-200">Redeem HRVST Tokens</h2>
          <p className="text-xs text-gray-400">
            Burns HRVST, debits Treasury stables, and records a CPA journal entry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 ${
              currentMode === 'demo' ? 'bg-violet-600/60 text-white' : 'bg-white/10 text-gray-300'
            }`}
          >
            Demo
          </span>
          <span
            className={`rounded-full px-3 py-1 ${
              currentMode === 'live' ? 'bg-amber-500/80 text-black' : 'bg-white/10 text-gray-300'
            }`}
          >
            Live
          </span>
          <button
            className="rounded-lg border border-white/20 px-3 py-1 text-[11px] uppercase text-gray-200 transition hover:border-white"
            type="button"
            onClick={handleToggle}
          >
            Toggle
          </button>
        </div>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 text-sm">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-400">Holder Id</span>
          <input
            className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
            value={holderId}
            onChange={(event) => setHolderId(event.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-gray-400">Tokens</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-violet-700/40 bg-indigo-950/60 p-3 text-gray-100 focus:border-violet-400 focus:outline-none"
            value={tokens}
            onChange={(event) => setTokens(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-lg bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 py-2 text-sm font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Processing…' : 'Submit Redemption'}
        </button>
      </form>
      {result && <p className="mt-4 text-xs text-emerald-300">{result}</p>}
      {error && <p className="mt-4 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
