import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ensureContractsConfigured } from '../lib/addressGuard.js';
import { fetchVerificationDossier, type VerificationDossier } from '../lib/verification.js';
import { createDossierPdf } from '../lib/dossierPdf.js';

const ParamsSchema = z.object({
  attestationId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

function convertBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => convertBigInts(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, convertBigInts(val)]));
  }
  return value;
}

function serializeDossier(dossier: VerificationDossier) {
  const timestampBigInt = dossier.attestation.timestamp;
  const timestampString = timestampBigInt.toString();
  return {
    attestation: {
      ...dossier.attestation,
      timestamp: timestampString,
    },
    affidavit: convertBigInts(dossier.affidavit),
    audit: convertBigInts(dossier.audit),
    safeVault: {
      docHashes: [...dossier.safeVault.docHashes],
    },
  };
}

export default async function verifyRoutes(app: FastifyInstance) {
  app.get('/verify/:attestationId', async (req, reply) => {
    const params = ParamsSchema.parse(req.params);
    if (!(await ensureContractsConfigured(app, reply, 'VERIFY', { attestationId: params.attestationId }))) {
      return;
    }
    const dossier = await fetchVerificationDossier(app, params.attestationId);
    if (!dossier) {
      return reply.status(404).send({ error: 'attestation_not_found' });
    }
    return reply.send(serializeDossier(dossier));
  });

  app.get('/verify/:attestationId/pdf', async (req, reply) => {
    const params = ParamsSchema.parse(req.params);
    if (!(await ensureContractsConfigured(app, reply, 'VERIFY', { attestationId: params.attestationId }))) {
      return;
    }
    const dossier = await fetchVerificationDossier(app, params.attestationId);
    if (!dossier) {
      return reply.status(404).send({ error: 'attestation_not_found' });
    }
    const buffer = await createDossierPdf(dossier);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="dossier-${params.attestationId}.pdf"`)
      .send(buffer);
  });
}
