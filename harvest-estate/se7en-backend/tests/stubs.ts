import type { ContractsGateway, NoteRecord } from '../src/lib/contracts.js';
import type { AuditEntry, AuditLogger, AuditLogRecord } from '../src/plugins/audit.js';
import { signJwt } from '../src/lib/jwt.js';
import type { JwtClaims } from '../src/lib/jwt.js';
import type { SignatureStore, EnvelopeRecordInput, EventRecordInput } from '../src/signing/store.js';
import type { SigningProvider, CreateEnvelopeRequest, CreateEnvelopeResult } from '../src/signing/provider.js';
import type { VaultRepository, Mailer } from '../src/plugins/vault.js';
import { Hex } from 'viem';

const ZERO_HEX = '0x0000000000000000000000000000000000000000000000000000000000000000';

const TEST_JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_SECRET = TEST_JWT_SECRET;

function makeHash(tag: string): Hex {
  const hex = Array.from(tag)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64)
    .padEnd(64, '0');
  return (`0x${hex}`) as Hex;
}

export function createStubContracts(overrides: Partial<ContractsGateway> = {}): ContractsGateway {
  const defaultNote: NoteRecord = {
    assetId: makeHash('asset'),
    instrumentType: 1n,
    par: 1n,
    nav: 1n,
    affidavitId: ZERO_HEX,
    attestationId: ZERO_HEX,
    active: true,
  };

  const base: ContractsGateway = {
    operatorAddress: makeHash('operator'),
    async setCustody() {
      return makeHash('custody');
    },
    async setDoc() {
      return makeHash('doc');
    },
    async hasCustody() {
      return true;
    },
    async getDocHashes() {
      return [];
    },
    async createAffidavit() {
      return { affidavitId: makeHash('affidavit'), txHash: makeHash('afftx') };
    },
    async latestAffidavit() {
      return makeHash('affidavit');
    },
    async getAffidavit() {
      return {
        assetId: makeHash('asset'),
        documentHash: makeHash('doc'),
        witness: makeHash('witness'),
        timestamp: 0n,
        metadata: makeHash('meta'),
      };
    },
    async recordAttestation() {
      return { attestationId: makeHash('attestation'), txHash: makeHash('atttx') };
    },
    async getAttestation() {
      return {
        subjectId: makeHash('asset'),
        payloadHash: makeHash('payload'),
        clause: 'INTAKE',
        timestamp: 0n,
        attestor: makeHash('attestor'),
      };
    },
    async setAssetNav() {
      return makeHash('nav');
    },
    async issueInstrument() {
      return { noteId: 1n, txHash: makeHash('issuance') };
    },
    async getAggregateNav() {
      return { navCsdn: 1n, navSdn: 1n };
    },
    async updateNoteAttestation() {
      return makeHash('update');
    },
    async getNote() {
      return defaultNote;
    },
    async bindCoverage() {
      return { binderId: makeHash('binder'), txHash: makeHash('bindtx') };
    },
    async runCycle() {
      return { cycleId: makeHash('cycle'), txHash: makeHash('cycletx') };
    },
    async animaOk() {
      return true;
    },
    async mintByNav() {
      return { amount: 1n, txHash: makeHash('mint') };
    },
    async burnFrom() {
      return makeHash('burn');
    },
    async settleRedemption() {
      return makeHash('settle');
    },
  };

  return { ...base, ...overrides };
}

export class MemoryAuditLogger implements AuditLogger {
  public records: AuditEntry[] = [];

  async log(entry: AuditEntry): Promise<void> {
    this.records.push(entry);
  }

  async history(limit = 50): Promise<AuditLogRecord[]> {
    const startIndex = Math.max(this.records.length - limit, 0);
    return this.records.slice(startIndex).map((record, offset) => ({
      id: startIndex + offset + 1,
      action: record.action,
      assetId: record.assetId ?? 'system',
      attestationId: record.attestationId ?? null,
      txHash: record.txHash ?? null,
      payload: record.payload ?? {},
      createdAt: new Date(),
    }));
  }

  async findByAttestation(attestationId: string): Promise<AuditLogRecord | null> {
    for (let idx = this.records.length - 1; idx >= 0; idx -= 1) {
      const record = this.records[idx];
      if (record.attestationId === attestationId) {
        return {
          id: idx + 1,
          action: record.action,
          assetId: record.assetId ?? 'system',
          attestationId: record.attestationId ?? null,
          txHash: record.txHash ?? null,
          payload: record.payload ?? {},
          createdAt: new Date(),
        };
      }
    }
    return null;
  }
}

export function createJwt(role: string, claims: Partial<JwtClaims> = {}): string {
  const payload: JwtClaims = {
    sub: 'test-user',
    email: 'test@harvest.estate',
    role,
    ...claims,
  };

  return signJwt(payload, TEST_JWT_SECRET, {
    expiresInSeconds: 3600,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  });
}

export class MemorySignatureStore implements SignatureStore {
  public envelopes: EnvelopeRecordInput[] = [];
  public events: EventRecordInput[] = [];

  async createEnvelope(input: EnvelopeRecordInput): Promise<void> {
    const existingIndex = this.envelopes.findIndex((envelope) => envelope.envelopeId === input.envelopeId);
    if (existingIndex >= 0) {
      this.envelopes[existingIndex] = input;
    } else {
      this.envelopes.push(input);
    }
  }

  async updateEnvelopeStatus(envelopeId: string, status: string, signedAt?: Date | null, signerEmail?: string | null): Promise<void> {
    const envelope = this.envelopes.find((item) => item.envelopeId === envelopeId);
    if (envelope) {
      envelope.status = status;
      envelope.signedAt = signedAt ?? null;
      envelope.signerEmail = signerEmail ?? null;
    } else {
      this.envelopes.push({
        envelopeId,
        provider: 'UNKNOWN',
        type: 'UNKNOWN',
        assetId: undefined,
        status,
        sha256: '',
        signedAt: signedAt ?? null,
        signerEmail: signerEmail ?? null,
      });
    }
  }

  async recordEvent(input: EventRecordInput): Promise<void> {
    this.events.push(input);
  }

  async close(): Promise<void> {
    // no-op for in-memory store
  }
}

export function createSigningProviderStub(overrides: Partial<SigningProvider> = {}): SigningProvider {
  const base: SigningProvider = {
    name: 'STUB',
    async createEnvelope(request: CreateEnvelopeRequest): Promise<CreateEnvelopeResult> {
      return {
        envelopeId: `env_${Math.random().toString(36).slice(2)}`,
        status: 'SENT',
        signerEmail: request.recipients[0]?.email,
      };
    },
    verifyWebhookSignature: () => true,
  };

  return { ...base, ...overrides };
}

export class MemoryVaultRepository implements VaultRepository {
  public docs: Array<{ assetId: string; name: string; sha256: string; status?: string }> = [];

  async createOrUpdateDoc({ assetId, name, sha256, status }: { assetId: string; name: string; sha256: string; status?: string }): Promise<void> {
    const existing = this.docs.find((doc) => doc.sha256 === sha256);
    if (existing) {
      existing.assetId = assetId;
      existing.name = name;
      existing.status = status;
    } else {
      this.docs.push({ assetId, name, sha256, status });
    }
  }

  async close(): Promise<void> {
    // no-op for in-memory store
  }
}

export class MemoryMailer implements Mailer {
  public messages: Array<{ to: string[]; subject: string; text: string; from?: string }> = [];
  public shouldFail = false;

  async send(options: { to: string[]; subject: string; text: string; from?: string }): Promise<void> {
    if (this.shouldFail) {
      throw new Error('smtp_error');
    }
    this.messages.push(options);
  }

  async close(): Promise<void> {
    // no-op
  }
}
