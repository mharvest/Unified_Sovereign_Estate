import { decodeEventLog, type AbiEvent, type Hex, type PublicClient } from 'viem';
import {
  AffidavitRegistryABI,
  EklesiaAttestorABI,
  HRVSTABI,
  KiiantuCyclesABI,
  MatriarchInsuranceABI,
  SafeVaultABI,
  VaultQuantABI,
} from '../abi/index.js';
import { clients } from '../lib/contracts.js';

export interface ParsedEvent {
  eventUid: string;
  module: string;
  kind: string;
  juraHash: string;
  txHash?: string | null;
  blockNumber?: number | null;
  payload: Record<string, unknown>;
}

type ModuleKey = keyof typeof clients;
type EventArgs = Record<string, unknown> & { [index: number]: unknown };
type ChainLog = Awaited<ReturnType<PublicClient['getLogs']>>[number];

const MODULE_EVENTS: Partial<Record<ModuleKey, readonly AbiEvent[]>> = {
  eklesia: extractEvents(EklesiaAttestorABI),
  eyeion: extractEvents(AffidavitRegistryABI),
  safevault: extractEvents(SafeVaultABI),
  vaultquant: extractEvents(VaultQuantABI),
  matriarch: extractEvents(MatriarchInsuranceABI),
  kiiantu: extractEvents(KiiantuCyclesABI),
  hrvst: extractEvents(HRVSTABI),
};

const EVENT_BUILDERS: Record<string, (args: EventArgs, log: ChainLog) => ParsedEvent | null> = {
  'eklesia:Attested': (args, log) =>
    buildEvent('eklesia', 'Attested', log, stringValue(args, 'payloadHash'), {
      attestationId: stringValue(args, 'attestationId'),
      subjectId: stringValue(args, 'subjectId'),
      payloadHash: stringValue(args, 'payloadHash'),
      jurisdiction: stringValue(args, 'jurisdiction'),
      clause: stringValue(args, 'clause'),
      timestamp: numericString(args, 'timestamp'),
      attestor: stringValue(args, 'attestor'),
    }),

  'eyeion:AffidavitCreated': (args, log) =>
    buildEvent('eyeion', 'AffidavitCreated', log, stringValue(args, 'documentHash'), {
      affidavitId: stringValue(args, 'affidavitId'),
      assetId: stringValue(args, 'assetId'),
      documentHash: stringValue(args, 'documentHash'),
      witness: stringValue(args, 'witness'),
      timestamp: numericString(args, 'timestamp'),
    }),

  'safevault:CustodyUpdated': (args, log) =>
    buildEvent('safevault', 'CustodyUpdated', log, stringValue(args, 'assetId'), {
      assetId: stringValue(args, 'assetId'),
      custody: args.custody ?? false,
      timestamp: numericString(args, 'timestamp'),
      actor: stringValue(args, 'actor'),
    }),

  'safevault:DocumentStored': (args, log) =>
    buildEvent('safevault', 'DocumentStored', log, stringValue(args, 'docHash'), {
      assetId: stringValue(args, 'assetId'),
      docHash: stringValue(args, 'docHash'),
      actor: stringValue(args, 'actor'),
    }),

  'vaultquant:AssetNavSet': (args, log) =>
    buildEvent('vaultquant', 'AssetNavSet', log, stringValue(args, 'assetId'), {
      assetId: stringValue(args, 'assetId'),
      nav: numericString(args, 'nav'),
      actor: stringValue(args, 'actor'),
    }),

  'vaultquant:InstrumentIssued': (args, log) =>
    buildEvent('vaultquant', 'InstrumentIssued', log, stringValue(args, 'affidavitId'), {
      noteId: numericString(args, 'noteId'),
      assetId: stringValue(args, 'assetId'),
      instrumentType: numericString(args, 'instrumentType'),
      par: numericString(args, 'par'),
      nav: numericString(args, 'nav'),
      affidavitId: stringValue(args, 'affidavitId'),
    }),

  'vaultquant:InstrumentRedeemed': (args, log) =>
    buildEvent('vaultquant', 'InstrumentRedeemed', log, numericString(args, 'noteId'), {
      noteId: numericString(args, 'noteId'),
      amount: numericString(args, 'amount'),
      remainingNav: numericString(args, 'remainingNav'),
    }),

  'vaultquant:NoteNavUpdated': (args, log) =>
    buildEvent('vaultquant', 'NoteNavUpdated', log, numericString(args, 'noteId'), {
      noteId: numericString(args, 'noteId'),
      nav: numericString(args, 'nav'),
    }),

  'matriarch:CoverageBound': (args, log) =>
    buildEvent('matriarch', 'CoverageBound', log, stringValue(args, 'binderId'), {
      binderId: stringValue(args, 'binderId'),
      assetId: stringValue(args, 'assetId'),
      classCode: numericString(args, 'classCode'),
      factorBps: numericString(args, 'factorBps'),
      underwriter: stringValue(args, 'underwriter'),
    }),

  'matriarch:BandsDisclosureAnchored': (args, log) =>
    buildEvent('matriarch', 'BandsDisclosureAnchored', log, stringValue(args, 'disclosureHash'), {
      disclosureHash: stringValue(args, 'disclosureHash'),
      timestamp: numericString(args, 'timestamp'),
    }),

  'kiiantu:CycleRun': (args, log) =>
    buildEvent('kiiantu', 'CycleRun', log, stringValue(args, 'cycleId'), {
      cycleId: stringValue(args, 'cycleId'),
      noteId: numericString(args, 'noteId'),
    }),

  'hrvst:MintByNAV': (args, log) =>
    buildEvent('hrvst', 'MintByNAV', log, stringValue(args, 'to'), {
      to: stringValue(args, 'to'),
      amount: numericString(args, 'amount'),
      navCsdn: numericString(args, 'navCsdn'),
      navSdn: numericString(args, 'navSdn'),
      floorBps: numericString(args, 'floorBps'),
    }),
};

export async function parseLogs(
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  addresses: Hex[],
): Promise<ParsedEvent[]> {
  if (addresses.length === 0) {
    return [];
  }

  const logs = await client.getLogs({
    address: addresses,
    fromBlock,
    toBlock,
  });

  if (logs.length === 0) {
    return [];
  }

  const moduleByAddress = buildModuleAddressMap();
  const events: ParsedEvent[] = [];

  for (const log of logs) {
    const module = moduleByAddress.get(log.address.toLowerCase() as Hex);
    if (!module) continue;

    const abiEvents = MODULE_EVENTS[module];
    if (!abiEvents || abiEvents.length === 0) continue;

    const parsed = decodeModuleEvent(module, abiEvents, log);
    if (parsed) {
      events.push(parsed);
    }
  }

  return events;
}

function decodeModuleEvent(module: ModuleKey, abiEvents: readonly AbiEvent[], log: ChainLog): ParsedEvent | null {
  for (const abiEvent of abiEvents) {
    try {
      const decoded = decodeEventLog({
        abi: [abiEvent],
        data: log.data,
        topics: log.topics,
        strict: true,
      });
      const args = decoded.args as EventArgs;
      const builder = EVENT_BUILDERS[`${module}:${decoded.eventName}`];
      if (!builder) {
        continue;
      }
      return builder(args, log);
    } catch (error) {
      // try next event definition
      continue;
    }
  }
  return null;
}

function buildModuleAddressMap(): Map<Hex, ModuleKey> {
  const map = new Map<Hex, ModuleKey>();
  for (const [module, address] of Object.entries(clients) as Array<[ModuleKey, Hex | 'missing']>) {
    if (address === 'missing') continue;
    map.set(address.toLowerCase() as Hex, module);
  }
  return map;
}

function buildEvent(
  module: string,
  kind: string,
  log: ChainLog,
  juraHash: string,
  payload: Record<string, unknown>,
): ParsedEvent {
  const blockNumber =
    typeof log.blockNumber === 'bigint'
      ? Number(log.blockNumber)
      : typeof log.blockNumber === 'number'
      ? log.blockNumber
      : null;

  return {
    eventUid: `${log.transactionHash ?? '0x0'}:${log.logIndex ?? 0}`,
    module,
    kind,
    juraHash,
    txHash: log.transactionHash ?? null,
    blockNumber,
    payload: serialize(payload),
  };
}

function extractEvents(abi: readonly unknown[]): AbiEvent[] {
  return abi.filter((item): item is AbiEvent => (item as { type?: string }).type === 'event');
}

function serialize(value: unknown): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serialize(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, serialize(val)]),
    );
  }
  return value;
}

function stringValue(args: EventArgs, key: string): string {
  const value = args[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function numericString(args: EventArgs, key: string): string {
  const value = args[key];
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (value === undefined || value === null) return '0';
  return String(value);
}
