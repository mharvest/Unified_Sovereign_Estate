export function FiduciaryConsolePanel() {
  const estates = [
    { label: 'CPA', status: 'SIGNED', time: '12:46 UTC' },
    { label: 'Treasury', status: 'QUEUED', time: 'Awaiting floor confirmation' },
    { label: 'Underwriter', status: 'SIGNED', time: '12:40 UTC' },
    { label: 'Insurance', status: 'SIGNED', time: '12:38 UTC' },
  ];

  return (
    <div className="rounded-2xl border border-violet-700/40 bg-indigo-950/60 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-violet-200">Fiduciary Signatures</h2>
      <p className="mb-4 text-xs text-gray-400">
        Clearance-based approvals routed through Se7en multi-witness protocol.
      </p>
      <ul className="space-y-3 text-sm">
        {estates.map((row) => (
          <li key={row.label} className="flex items-center justify-between rounded-lg bg-indigo-900/40 px-4 py-3">
            <span className="text-gray-300">{row.label}</span>
            <span className="text-xs font-semibold text-emerald-300">{row.status}</span>
            <span className="text-[11px] text-gray-500">{row.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
