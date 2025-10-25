import { useMemo, useState } from 'react';
import type { Connector } from 'wagmi';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function formatAddress(address?: string | null) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletStatus() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError, isLoading, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  const [localError, setLocalError] = useState<string | null>(null);

  const readyConnectors = useMemo(() => connectors.filter((connector) => connector.ready), [connectors]);
  const fallbackConnectors = useMemo(() => connectors.filter((connector) => !connector.ready), [connectors]);

  const handleConnect = async (connector: Connector) => {
    try {
      setLocalError(null);
      await connect({ connector });
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : 'Failed to connect wallet';
      setLocalError(message);
    }
  };

  const errorMessage = useMemo(() => {
    if (localError) return localError;
    if (connectError?.message) return connectError.message;
    return null;
  }, [connectError?.message, localError]);

  return (
    <div className="flex flex-col items-end text-right text-xs">
      {isConnected ? (
        <>
          <span className="text-white/50">Wallet Connected</span>
          <p className="mt-1 text-[11px] text-white/40">{formatAddress(address)}</p>
          <button
            onClick={() => disconnect()}
            className="mt-3 rounded-full border border-white/10 bg-midnight px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 transition hover:border-rose-400 hover:text-white"
          >
            Disconnect
          </button>
        </>
      ) : (
        <>
          <span className="text-white/50">Wallet</span>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {readyConnectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector)}
                disabled={isLoading && pendingConnector?.id === connector.id}
                className="rounded-full border border-white/10 bg-midnight px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 transition hover:border-amethyst hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading && pendingConnector?.id === connector.id ? 'Connecting…' : `Connect ${connector.name}`}
              </button>
            ))}
          </div>
          {readyConnectors.length === 0 && (
            <p className="mt-2 max-w-[200px] text-[11px] text-white/40">
              Install a browser wallet or open the console in a WalletConnect enabled client.
            </p>
          )}
          {fallbackConnectors.length > 0 && readyConnectors.length === 0 && (
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              {fallbackConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector)}
                  className="rounded-full border border-white/10 bg-midnight px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 transition hover:border-amethyst hover:text-white"
                >
                  {`Use ${connector.name}`}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {errorMessage && <p className="mt-2 max-w-[220px] text-[11px] text-rose-300">{errorMessage}</p>}
    </div>
  );
}
