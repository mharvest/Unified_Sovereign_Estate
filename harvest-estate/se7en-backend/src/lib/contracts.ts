import { Hex, Hash, createPublicClient, createWalletClient, hexToString, http, defineChain, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AffidavitRegistryABI,
  AnimaABI,
  EklesiaAttestorABI,
  HRVSTABI,
  KiiantuCyclesABI,
  MatriarchInsuranceABI,
  SafeVaultABI,
  VaultQuantABI,
} from '../abi/index.js';

export interface ContractAddresses {
  eklesia: Hex;
  affidavitRegistry: Hex;
  safeVault: Hex;
  vaultQuant: Hex;
  matriarch: Hex;
  hrvs: Hex;
  kianitu: Hex;
  anima: Hex;
}

export interface ContractsConfig {
  rpcUrl: string;
  chainId: number;
  operatorKey: Hex;
  addresses: ContractAddresses;
}

export interface ContractsGateway {
  operatorAddress: Hex;
  setCustody(assetId: Hex, value: boolean): Promise<Hash>;
  setDoc(assetId: Hex, docHash: Hex): Promise<Hash>;
  hasCustody(assetId: Hex): Promise<boolean>;
  getDocHashes(assetId: Hex): Promise<Hex[]>;
  createAffidavit(assetId: Hex, meta: Hex): Promise<{ affidavitId: Hex; txHash: Hash }>;
  latestAffidavit(assetId: Hex): Promise<Hex>;
  getAffidavit(affidavitId: Hex): Promise<AffidavitRecord>;
  recordAttestation(subjectId: Hex, payloadHash: Hex, clause: string): Promise<{ attestationId: Hex; txHash: Hash }>;
  getAttestation(attestationId: Hex): Promise<AttestationRecord>;
  setAssetNav(assetId: Hex, navWei: bigint): Promise<Hash>;
  issueInstrument(type: 'CSDN' | 'SDN', assetId: Hex, par: bigint): Promise<{ noteId: bigint; txHash: Hash }>;
  getAggregateNav(): Promise<{ navCsdn: bigint; navSdn: bigint }>;
  updateNoteAttestation(noteId: bigint, attestationId: Hex): Promise<Hash>;
  getNote(noteId: bigint): Promise<NoteRecord>;
  bindCoverage(assetId: Hex, classCode: number, factorBps: bigint, disclosureHash: Hex): Promise<{ binderId: Hex; txHash: Hash }>;
  runCycle(noteId: bigint, tenorDays: number, rateBps: number): Promise<{ cycleId: Hex; txHash: Hash }>;
  animaOk(assetId: Hex, action: Hex): Promise<boolean>;
  mintByNav(navCsdn: bigint, navSdn: bigint, floorBps: bigint, to: Hex): Promise<{ amount: bigint; txHash: Hash }>;
  burnFrom(holder: Hex, amount: bigint): Promise<Hash>;
  settleRedemption(noteId: bigint, amount: bigint): Promise<Hash>;
}

export const clients: Record<keyof ContractAddresses, Hex | 'missing'> = {
  eklesia: 'missing',
  safevault: 'missing',
  eyeion: 'missing',
  vaultquant: 'missing',
  matriarch: 'missing',
  hrvst: 'missing',
  kiiantu: 'missing',
  anima: 'missing',
};

export interface AttestationRecord {
  subjectId: Hex;
  payloadHash: Hex;
  clause: string;
  timestamp: bigint;
  attestor: Hex;
}

export interface AffidavitRecord {
  assetId: Hex;
  documentHash: Hex;
  witness: Hex;
  timestamp: bigint;
  metadata: Hex;
}

export interface NoteRecord {
  assetId: Hex;
  instrumentType: bigint;
  par: bigint;
  nav: bigint;
  affidavitId: Hex;
  attestationId: Hex;
  active: boolean;
}

export function loadContractsConfigFromEnv(): ContractsConfig {
  const rpcUrl = process.env.HARDHAT_RPC || process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error('HARDHAT_RPC (or RPC_URL) is required');
  }

  const privateKey = normalizePrivateKey(process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.PRIVATE_KEY);
  const chainId = Number(process.env.CHAIN_ID || 31337);

  const envMap: Record<keyof ContractAddresses, string> = {
    eklesia: 'EKLESIA_ADDRESS',
    affidavitRegistry: 'EYEION_ADDRESS',
    safeVault: 'SAFEVAULT_ADDRESS',
    vaultQuant: 'VAULTQUANT_ADDRESS',
    matriarch: 'MATRIARCH_ADDRESS',
    hrvs: 'HRVST_ADDRESS',
    kianitu: 'KIANITU_ADDRESS',
    anima: 'ANIMA_ADDRESS',
  };

  const addresses: Partial<ContractAddresses> = {};
  for (const key of Object.keys(envMap) as Array<keyof ContractAddresses>) {
    const envName = envMap[key];
    const value = process.env[envName];
    if (!value) {
      throw new Error(`${envName} is required`);
    }
    addresses[key] = value as Hex;
  }

  return {
    rpcUrl,
    chainId,
    operatorKey: privateKey,
    addresses: addresses as ContractAddresses,
  };
}

function normalizePrivateKey(value?: string | null): Hex {
  if (!value) {
    throw new Error('ORCHESTRATOR_PRIVATE_KEY is required');
  }
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

export function createContractsGateway(config: ContractsConfig): ContractsGateway {
  const account = privateKeyToAccount(config.operatorKey);
  const chain = defineChain({
    id: config.chainId,
    name: 'sovereign-devnet',
    network: 'sovereign-devnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
  });

  const transport = http(config.rpcUrl, { timeout: 120_000 });
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account });

  // Update global client map for diagnostics
  clients.eklesia = config.addresses.eklesia;
  clients.safevault = config.addresses.safeVault;
  clients.eyeion = config.addresses.affidavitRegistry;
  clients.vaultquant = config.addresses.vaultQuant;
  clients.matriarch = config.addresses.matriarch;
  clients.hrvst = config.addresses.hrvs;
  clients.kiiantu = config.addresses.kianitu;
  clients.anima = config.addresses.anima;

  const write = async <T = undefined>(params: {
    abi: readonly unknown[];
    address: Hex;
    functionName: string;
    args: readonly unknown[];
  }): Promise<{ hash: Hash; result: T }> => {
    const { request, result } = await publicClient.simulateContract({
      account,
      ...params,
    });
    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
    return { hash, result: result as T };
  };

  const read = async <T>(params: {
    abi: readonly unknown[];
    address: Hex;
    functionName: string;
    args?: readonly unknown[];
  }): Promise<T> => {
    return publicClient.readContract({
      ...params,
    }) as Promise<T>;
  };

  return {
    operatorAddress: account.address as Hex,

    async setCustody(assetId, value) {
      const { hash } = await write({
        abi: SafeVaultABI,
        address: config.addresses.safeVault,
        functionName: 'setCustody',
        args: [assetId, value],
      });
      return hash;
    },

    async setDoc(assetId, docHash) {
      const { hash } = await write({
        abi: SafeVaultABI,
        address: config.addresses.safeVault,
        functionName: 'setDoc',
        args: [assetId, docHash],
      });
      return hash;
    },

    async hasCustody(assetId) {
      return read<boolean>({
        abi: SafeVaultABI,
        address: config.addresses.safeVault,
        functionName: 'hasCustody',
        args: [assetId],
      });
    },

    async getDocHashes(assetId) {
      return read<Hex[]>({
        abi: SafeVaultABI,
        address: config.addresses.safeVault,
        functionName: 'getDocHashes',
        args: [assetId],
      });
    },

    async createAffidavit(assetId, meta) {
      const { hash, result } = await write<Hex>({
        abi: AffidavitRegistryABI,
        address: config.addresses.affidavitRegistry,
        functionName: 'createAffidavit',
        args: [assetId, meta],
      });
      return { affidavitId: result, txHash: hash };
    },

    async latestAffidavit(assetId) {
      return read<Hex>({
        abi: AffidavitRegistryABI,
        address: config.addresses.affidavitRegistry,
        functionName: 'latestAffidavit',
        args: [assetId],
      });
    },

    async getAffidavit(affidavitId) {
      const result = await read<{
        assetId: Hex;
        documentHash: Hex;
        witness: Hex;
        timestamp: bigint;
        metadata: Hex;
      }>({
        abi: AffidavitRegistryABI,
        address: config.addresses.affidavitRegistry,
        functionName: 'getAffidavit',
        args: [affidavitId],
      });
      return result;
    },

    async recordAttestation(subjectId, payloadHash, clause) {
      const clauseBytes = stringToHex(clause, { size: 32 }) as Hex;
      const { hash, result } = await write<Hex>({
        abi: EklesiaAttestorABI,
        address: config.addresses.eklesia,
        functionName: 'recordAttestation',
        args: [subjectId, payloadHash, clauseBytes],
      });
      return { attestationId: result, txHash: hash };
    },

    async getAttestation(attestationId) {
      const tuple = await read<[
        Hex,
        Hex,
        Hex,
        bigint,
        Hex
      ]>({
        abi: EklesiaAttestorABI,
        address: config.addresses.eklesia,
        functionName: 'get',
        args: [attestationId],
      });
      return {
        subjectId: tuple[0],
        payloadHash: tuple[1],
        clause: hexToString(tuple[2], { size: 32 }).replace(/\0+$/, ''),
        timestamp: tuple[3],
        attestor: tuple[4],
      };
    },

    async setAssetNav(assetId, navWei) {
      const { hash } = await write({
        abi: VaultQuantABI,
        address: config.addresses.vaultQuant,
        functionName: 'setAssetNAV',
        args: [assetId, navWei],
      });
      return hash;
    },

    async issueInstrument(type, assetId, par) {
      const functionName = type === 'CSDN' ? 'issueCSDN' : 'issueSDN';
      const { hash, result } = await write<bigint>({
        abi: VaultQuantABI,
        address: config.addresses.vaultQuant,
        functionName,
        args: [assetId, par],
      });
      return { noteId: result, txHash: hash };
    },

    async getAggregateNav() {
      const [navCsdn, navSdn] = await read<[bigint, bigint]>({
        abi: VaultQuantABI,
        address: config.addresses.vaultQuant,
        functionName: 'getAggregateNAV',
        args: [],
      });
      return { navCsdn, navSdn };
    },

    async updateNoteAttestation(noteId, attestationId) {
      const { hash } = await write({
        abi: VaultQuantABI,
        address: config.addresses.vaultQuant,
        functionName: 'updateNoteAttestation',
        args: [noteId, attestationId],
      });
      return hash;
    },

    async getNote(noteId) {
      const tuple = await read<any>({
        abi: VaultQuantABI,
        address: config.addresses.vaultQuant,
        functionName: 'getNote',
        args: [noteId],
      });
      const values = Array.isArray(tuple)
        ? tuple
        : [
            tuple.assetId,
            tuple.instrumentType,
            tuple.par,
            tuple.nav,
            tuple.affidavitId,
            tuple.attestationId,
            tuple.active,
          ];

      return {
        assetId: values[0] as Hex,
        instrumentType: values[1] as bigint,
        par: values[2] as bigint,
        nav: values[3] as bigint,
        affidavitId: values[4] as Hex,
        attestationId: values[5] as Hex,
        active: values[6] as boolean,
      };
    },

    async bindCoverage(assetId, classCode, factorBps, disclosureHash) {
      const { hash, result } = await write<Hex>({
        abi: MatriarchInsuranceABI,
        address: config.addresses.matriarch,
        functionName: 'bindCoverage',
        args: [assetId, BigInt(classCode), factorBps, disclosureHash],
      });
      return { binderId: result, txHash: hash };
    },

    async runCycle(noteId, tenorDays, rateBps) {
      const { hash, result } = await write<Hex>({
        abi: KiiantuCyclesABI,
        address: config.addresses.kianitu,
        functionName: 'runCycle',
        args: [noteId, BigInt(tenorDays), BigInt(rateBps)],
      });
      return { cycleId: result, txHash: hash };
    },

    async animaOk(assetId, action) {
      return read<boolean>({
        abi: AnimaABI,
        address: config.addresses.anima,
        functionName: 'ok',
        args: [assetId, action],
      });
    },

    async mintByNav(navCsdn, navSdn, floorBps, to) {
      const { hash, result } = await write<bigint>({
        abi: HRVSTABI,
        address: config.addresses.hrvs,
        functionName: 'mintByNAV',
        args: [navCsdn, navSdn, floorBps, to],
      });
      return { amount: result, txHash: hash };
    },

    async burnFrom(holder, amount) {
      const { hash } = await write({
        abi: HRVSTABI,
        address: config.addresses.hrvs,
        functionName: 'burnFrom',
        args: [holder, amount],
      });
      return hash;
    },

    async settleRedemption(noteId, amount) {
      const { hash } = await write({
        abi: VaultQuantABI,
        address: config.addresses.vaultQuant,
        functionName: 'settleRedemption',
        args: [noteId, amount],
      });
      return hash;
    },
  };
}
