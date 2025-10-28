import type { FastifyInstance } from 'fastify';
import { normalizeBytes32 } from './utils.js';
import { JURISDICTION_TAG } from '../constants.js';

const ZERO_BYTES_32 = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface VerificationDossier {
  attestation: {
    id: string;
    subjectId: string;
    payloadHash: string;
    clause: string;
    timestamp: bigint;
    attestor: string;
    jurisdiction: string;
  };
  affidavit: unknown;
  audit: unknown;
  safeVault: {
    docHashes: string[];
  };
}

export async function fetchVerificationDossier(
  app: FastifyInstance,
  attestationId: string,
): Promise<VerificationDossier | null> {
  const attestationHex = normalizeBytes32(attestationId, 'attestationId');
  const attestation = await app.contracts.getAttestation(attestationHex);

  if (!attestation || attestation.subjectId === ZERO_BYTES_32) {
    return null;
  }

  const auditRecord = await app.audit.findByAttestation(attestationHex);

  let affidavit: unknown = null;
  if (auditRecord && auditRecord.payload && typeof auditRecord.payload === 'object') {
    const payload = auditRecord.payload as Record<string, unknown>;
    const affidavitId = payload.affidavitId;
    if (typeof affidavitId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(affidavitId)) {
      affidavit = await app.contracts.getAffidavit(affidavitId as `0x${string}`);
    }
  }

  const docHashes = await app.contracts.getDocHashes(attestation.subjectId);

  return {
    attestation: {
      id: attestationHex,
      subjectId: attestation.subjectId,
      payloadHash: attestation.payloadHash,
      clause: attestation.clause,
      timestamp: attestation.timestamp,
      attestor: attestation.attestor,
      jurisdiction: JURISDICTION_TAG,
    },
    affidavit,
    audit: auditRecord,
    safeVault: {
      docHashes,
    },
  };
}
