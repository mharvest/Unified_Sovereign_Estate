import { useMemo } from 'react';
import { useAccount, useContractReads } from 'wagmi';
import { stringToHex, keccak256 } from 'viem';
import { csdnAbi, getCsdnAddress } from '../csdn';

const ROLE_NAMES = ['CPA_ROLE', 'TREASURY_ROLE', 'UNDERWRITER_ROLE', 'TRUSTEE_ROLE'];

const ROLE_HASHES = ROLE_NAMES.map((name) => keccak256(stringToHex(name)));

export function useFiduciaryRole() {
  const { address } = useAccount();
  const csdnAddress = getCsdnAddress();

  const { data } = useContractReads({
    contracts: ROLE_HASHES.map((role) => ({
      address: csdnAddress as `0x${string}`,
      abi: csdnAbi as any,
      functionName: 'hasRole',
      args: [role, (address ?? '0x0000000000000000000000000000000000000000') as `0x${string}`]
    })),
    enabled: Boolean(address),
    allowFailure: true
  });

  return useMemo(() => {
    if (!address || !data) {
      return { roles: [] as string[], primaryRole: null as string | null };
    }
    const roles = ROLE_NAMES.filter((_, idx) => data[idx]?.result === true);
    return { roles, primaryRole: roles[0] ?? null };
  }, [address, data]);
}
