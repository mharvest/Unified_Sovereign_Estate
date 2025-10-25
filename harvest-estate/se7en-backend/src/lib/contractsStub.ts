import { randomBytes } from 'node:crypto';
import type { Hex, Hash } from 'viem';
import { ContractsGateway } from './contracts.js';

const ZERO_HEX_32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

function randomHex(bytes = 32): Hex {
  return `0x${randomBytes(bytes).toString('hex')}` as Hex;
}

function randomHash(): Hash {
  return randomHex(32) as Hash;
}

interface AttestationEntry {
  subjectId: Hex;
  payloadHash: Hex;
  clause: string;
  timestamp: bigint;
  attestor: Hex;
}

interface AffidavitEntry {
  assetId: Hex;
  documentHash: Hex;
  witness: Hex;
  timestamp: bigint;
  metadata: Hex;
}

interface NoteEntry {
  assetId: Hex;
  instrumentType: bigint;
  par: bigint;
  nav: bigint;
  affidavitId: Hex;
  attestationId: Hex;
  active: boolean;
}

export function createStubGateway(): ContractsGateway {
  const custody = new Map<Hex, boolean>();
  const docs = new Map<Hex, Hex[]>();
  const affidavits = new Map<Hex, AffidavitEntry>();
  const assetLatestAffidavit = new Map<Hex, Hex>();
  const attestations = new Map<Hex, AttestationEntry>();
  const notes = new Map<bigint, NoteEntry>();
  let noteCounter = 1n;
  let binderCounter = 1n;
  let cycleCounter = 1n;
  let navCsdn = 0n;
  let navSdn = 0n;

  const balances = new Map<Hex, bigint>();

  const operator = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

  return {
    operatorAddress: operator,

    async setCustody(assetId, value) {
      custody.set(assetId, value);
      return randomHash();
    },

    async setDoc(assetId, docHash) {
      const list = docs.get(assetId) ?? [];
      list.push(docHash);
      docs.set(assetId, list);
      return randomHash();
    },

    async hasCustody(assetId) {
      return custody.get(assetId) ?? false;
    },

    async getDocHashes(assetId) {
      return docs.get(assetId) ?? [];
    },

    async createAffidavit(assetId, meta) {
      const affidavitId = randomHex(32);
      const entry: AffidavitEntry = {
        assetId,
        documentHash: randomHex(32),
        witness: operator,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        metadata: meta,
      };
      affidavits.set(affidavitId, entry);
      assetLatestAffidavit.set(assetId, affidavitId);
      return { affidavitId, txHash: randomHash() };
    },

    async latestAffidavit(assetId) {
      return assetLatestAffidavit.get(assetId) ?? ZERO_HEX_32;
    },

    async getAffidavit(affidavitId) {
      const entry = affidavits.get(affidavitId);
      if (!entry) {
        return {
          assetId: ZERO_HEX_32,
          documentHash: ZERO_HEX_32,
          witness: operator,
          timestamp: 0n,
          metadata: ZERO_HEX_32,
        };
      }
      return entry;
    },

    async recordAttestation(subjectId, payloadHash, clause) {
      const attestationId = randomHex(32);
      const entry: AttestationEntry = {
        subjectId,
        payloadHash,
        clause,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        attestor: operator,
      };
      attestations.set(attestationId, entry);
      return { attestationId, txHash: randomHash() };
    },

    async getAttestation(attestationId) {
      const entry = attestations.get(attestationId);
      if (!entry) {
        return {
          subjectId: ZERO_HEX_32,
          payloadHash: ZERO_HEX_32,
          clause: '',
          timestamp: 0n,
          attestor: operator,
        };
      }
      return entry;
    },

    async setAssetNav(assetId, navWei) {
      // track nav per asset for reporting
      navCsdn = navWei;
      navSdn = navWei / 2n;
      return randomHash();
    },

    async issueInstrument(type, assetId, par) {
      const noteId = noteCounter++;
      notes.set(noteId, {
        assetId,
        instrumentType: type === 'CSDN' ? 0n : 1n,
        par,
        nav: par,
        affidavitId: await this.latestAffidavit(assetId),
        attestationId: ZERO_HEX_32,
        active: true,
      });
      return { noteId, txHash: randomHash() };
    },

    async getAggregateNav() {
      return { navCsdn, navSdn };
    },

    async updateNoteAttestation(noteId, attestationId) {
      const note = notes.get(noteId);
      if (note) {
        note.attestationId = attestationId;
        notes.set(noteId, note);
      }
      return randomHash();
    },

    async getNote(noteId) {
      const note = notes.get(noteId);
      if (!note) {
        return {
          assetId: ZERO_HEX_32,
          instrumentType: 0n,
          par: 0n,
          nav: 0n,
          affidavitId: ZERO_HEX_32,
          attestationId: ZERO_HEX_32,
          active: false,
        };
      }
      return note;
    },

    async bindCoverage(assetId, classCode, factorBps, disclosureHash) {
      const binderId = randomHex(32);
      attestations.set(binderId, {
        subjectId: assetId,
        payloadHash: disclosureHash,
        clause: `CLASS_${classCode}`,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        attestor: operator,
      });
      return { binderId, txHash: randomHash() };
    },

    async runCycle(noteId, tenorDays, rateBps) {
      const cycleId = randomHex(32);
      // mark note nav adjustment
      const note = notes.get(noteId);
      if (note) {
        note.nav = note.par + BigInt(rateBps) * 10n;
        notes.set(noteId, note);
      }
      return { cycleId, txHash: randomHash() };
    },

    async animaOk() {
      return true;
    },

    async mintByNav(navCsdnValue, navSdnValue, _floorBps, to) {
      const amount = navCsdnValue + navSdnValue;
      const current = balances.get(to) ?? 0n;
      balances.set(to, current + amount);
      return { amount, txHash: randomHash() };
    },

    async burnFrom(holder, amount) {
      const current = balances.get(holder) ?? 0n;
      balances.set(holder, current - amount);
      return randomHash();
    },

    async settleRedemption(noteId, amount) {
      const note = notes.get(noteId);
      if (note) {
        if (amount >= note.par) {
          note.par = 0n;
          note.active = false;
        } else {
          note.par -= amount;
        }
        notes.set(noteId, note);
      }
      return randomHash();
    },
  };
}
