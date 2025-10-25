import type { FastifyInstance } from 'fastify';
import type { FiduciaryRole } from '@prisma/client';
import { z } from 'zod';
import { CLAUSES } from '../constants.js';
import { actionHash, labelToAssetId, normalizeBytes32, payloadHash } from '../lib/utils.js';
import { ACTION_NAMES } from '../constants.js';
import { ensureContractsConfigured } from '../lib/addressGuard.js';
import type { Hex } from 'viem';

const InsuranceSchema = z.object({
  assetLabel: z.string().min(1),
  classCode: z.number().int().min(1),
  factorBps: z.union([z.string(), z.number(), z.bigint()]),
  disclosureHash: z.string().optional(),
  notes: z.string().optional(),
});

export default async function insuranceRoutes(app: FastifyInstance) {
  app.post('/insurance', { preHandler: app.authorize(['INSURANCE'] as FiduciaryRole[]) }, async (req, reply) => {
    const body = InsuranceSchema.parse(req.body);
    if (!(await ensureContractsConfigured(app, reply, CLAUSES.INSURANCE, { assetLabel: body.assetLabel }))) {
      return;
    }
    const assetId = labelToAssetId(body.assetLabel);

    const isAllowed = await app.contracts.animaOk(assetId, actionHash(ACTION_NAMES.NAV_UPDATE));
    if (!isAllowed) {
      return reply.status(409).send({ ok: false, error: 'anima_blocked' });
    }

    const factorBps =
      typeof body.factorBps === 'bigint'
        ? body.factorBps
        : typeof body.factorBps === 'number'
        ? BigInt(Math.trunc(body.factorBps))
        : BigInt(body.factorBps);

    let disclosureHash: Hex;
    if (body.disclosureHash) {
      disclosureHash = normalizeBytes32(body.disclosureHash, 'disclosureHash');
    } else {
      const disclosurePayload = payloadHash({ assetId, classCode: body.classCode, factorBps: factorBps.toString() });
      disclosureHash = disclosurePayload;
    }

    const { binderId, txHash } = await app.contracts.bindCoverage(
      assetId,
      body.classCode,
      factorBps,
      disclosureHash
    );

    const payload = {
      binderId,
      classCode: body.classCode,
      factorBps: factorBps.toString(),
      disclosureHash,
      notes: body.notes ?? null,
    };

    const { attestationId, txHash: attestationTx } = await app.contracts.recordAttestation(
      assetId,
      payloadHash(payload),
      CLAUSES.INSURANCE
    );

    await app.audit.log({
      action: CLAUSES.INSURANCE,
      assetId,
      attestationId,
      txHash: attestationTx,
      payload,
    });

    return reply.status(201).send({
      binderId,
      attestationId,
      txHashes: {
        coverage: txHash,
        attestation: attestationTx,
      },
    });
  });
}
