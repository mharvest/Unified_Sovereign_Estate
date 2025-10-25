import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { normalizeBytes32 } from '../lib/utils.js';
import { ensureContractsConfigured } from '../lib/addressGuard.js';
import { JURISDICTION_TAG } from '../constants.js';

const ParamsSchema = z.object({
  attestationId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export default async function verifyRoutes(app: FastifyInstance) {
  app.get('/verify/:attestationId', async (req, reply) => {
    const params = ParamsSchema.parse(req.params);
    if (!(await ensureContractsConfigured(app, reply, 'VERIFY', { attestationId: params.attestationId }))) {
      return;
    }
    const attestationId = normalizeBytes32(params.attestationId, 'attestationId');

    const attestation = await app.contracts.getAttestation(attestationId);
    const auditRecord = await app.audit.findByAttestation(attestationId);

    let affidavit: unknown = null;
    if (auditRecord?.payload && typeof auditRecord.payload === 'object') {
      const affidavitId = (auditRecord.payload as Record<string, unknown>).affidavitId;
      if (typeof affidavitId === 'string' && /^0x[0-9a-fA-F]{64}$/.test(affidavitId)) {
        affidavit = await app.contracts.getAffidavit(affidavitId as `0x${string}`);
      }
    }

    const docHashes = await app.contracts.getDocHashes(attestation.subjectId);

    return reply.send({
      attestation: {
        id: attestationId,
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
    });
  });
}
