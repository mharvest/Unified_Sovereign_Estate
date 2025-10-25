import { ConnectorNotFoundError } from 'wagmi';

export function resolveWalletError(error: unknown, fallback = 'Transaction failed') {
  if (error instanceof ConnectorNotFoundError) {
    return 'Connect a wallet to continue.';
  }

  if (typeof error === 'string') {
    const value = error.toLowerCase();
    if (value.includes('invalid key') || value.includes('code: 3000')) {
      return 'WalletConnect project ID is invalid or missing. Update NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.';
    }
    if (value.includes('connector not found')) {
      return 'Connect a wallet to continue.';
    }
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      const value = message.toLowerCase();
      if (value.includes('invalid key') || value.includes('code: 3000')) {
        return 'WalletConnect project ID is invalid or missing. Update NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.';
      }
      if (value.includes('connector not found')) {
        return 'Connect a wallet to continue.';
      }
      return message;
    }
  }

  return fallback;
}
