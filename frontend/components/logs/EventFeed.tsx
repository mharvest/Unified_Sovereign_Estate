import { ContractEventLog } from '../../lib/hooks/useEvents';

interface EventFeedProps {
  events: ContractEventLog[];
  title?: string;
}

export function EventFeed({ events, title = 'Event Feed' }: EventFeedProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-obsidian/80 p-4 shadow-neon">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-orchid">{title}</h3>
      <ul className="space-y-3 text-xs text-white/80">
        {events.length === 0 && <li className="text-center text-white/40">No fiduciary events yet.</li>}
        {events.map((event, idx) => (
          <li key={`${event.transactionHash}-${idx}`} className="rounded border border-white/5 bg-midnight/40 p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amethyst">{event.name}</span>
              {event.blockNumber && <span className="text-[10px] text-white/40">Block {Number(event.blockNumber)}</span>}
            </div>
            <dl className="mt-2 space-y-1">
              {Object.entries(event.args).map(([key, value]) => (
                <div key={key} className="flex justify-between text-[11px]">
                  <dt className="text-white/40">{key}</dt>
                  <dd className="text-white/80">{String(value)}</dd>
                </div>
              ))}
            </dl>
            {event.transactionHash && (
              <a href={`${process.env.NEXT_PUBLIC_EKLESIA_EXPLORER ?? '#'}tx/${event.transactionHash}`} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[10px] text-orchid hover:text-white">
                View transaction
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
