import { useEffect, useState } from 'react';
import { useContractEvent } from 'wagmi';
import { Address } from 'viem';
import { csdnAbi, getCsdnAddress } from '../csdn';
import { routerAbi, getRouterAddress } from '../router';

export interface ContractEventLog {
  name: string;
  args: Record<string, unknown>;
  blockNumber?: bigint;
  transactionHash?: string;
  timestamp?: number;
}

export function useEvents(enabled = true) {
  const [events, setEvents] = useState<ContractEventLog[]>([]);
  const csdnAddress = getCsdnAddress() as Address;
  const routerAddress = getRouterAddress() as Address;

  useContractEvent({
    address: csdnAddress,
    abi: csdnAbi,
    eventName: 'Originated',
    listener(log) {
      if (!enabled || !log) return;
      appendLogs('Originated', Array.isArray(log) ? log : [log]);
    }
  });

  useContractEvent({
    address: csdnAddress,
    abi: csdnAbi,
    eventName: 'Subscribed',
    listener(log) {
      if (!enabled || !log) return;
      appendLogs('Subscribed', Array.isArray(log) ? log : [log]);
    }
  });

  useContractEvent({
    address: routerAddress,
    abi: routerAbi,
    eventName: 'KYCSubscribed',
    listener(log) {
      if (!enabled || !log) return;
      appendLogs('KYCSubscribed', Array.isArray(log) ? log : [log]);
    }
  });

  function appendLogs(name: string, logs: any[]) {
    setEvents((prev) => [
      ...logs.map((log) => ({
        name,
        args: log.args ?? {},
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash
      })),
      ...prev
    ]);
  }

  useEffect(() => {
    if (!enabled) {
      setEvents([]);
    }
  }, [enabled]);

  return events;
}
