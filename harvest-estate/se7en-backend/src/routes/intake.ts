import type { FastifyInstance } from 'fastify';
import type { FiduciaryRole } from '@prisma/client';
import { z } from 'zod';
import { CLAUSES, JURISDICTION_TAG } from '../constants.js';
import {
  encodeJson,
  labelToAssetId,
  normalizeBytes32,
  nowSeconds,
  payloadHash,
} from '../lib/utils.js';
import { ensureContractsConfigured } from '../lib/addressGuard.js';

const IntakeSchema = z.object({
  assetLabel: z.string().min(1),
  docs: z
    .array(
      z.object({
        type: z.string().min(1),
        hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

const AFFIDAVIT_CLAUSE = 'Affidavit of Standing / Issuance|Insurance|Redemption';

export default async function intakeRoutes(app: FastifyInstance) {
  app.post('/intake', { preHandler: app.authorize(['LAW', 'OPS'] as FiduciaryRole[]) }, async (req, reply) => {
    const body = IntakeSchema.parse(req.body);

    if (!(await ensureContractsConfigured(app, reply, CLAUSES.INTAKE, { assetLabel: body.assetLabel }))) {
      return;
    }

    const assetId = labelToAssetId(body.assetLabel);
    const docHashes = body.docs.map((doc) => normalizeBytes32(doc.hash, 'doc.hash'));

    const custodyTx = await app.contracts.setCustody(assetId, true);
    const docTxHashes: string[] = [];
    for (const hash of docHashes) {
      const txHash = await app.contracts.setDoc(assetId, hash);
      docTxHashes.push(txHash);
    }

    const affidavitMeta = {
      assetId,
      docHash: docHashes[0],
      jurisdiction: JURISDICTION_TAG,
      clause: AFFIDAVIT_CLAUSE,
      ts: nowSeconds(),
      witness: app.contracts.operatorAddress,
      notes: body.notes ?? '',
    };

    const affidavitPayload = encodeJson(affidavitMeta);
    const { affidavitId, txHash: affidavitTx } = await app.contracts.createAffidavit(
      assetId,
      affidavitPayload
    );

    const payloadDigest = payloadHash(affidavitMeta);
    const { attestationId, txHash: attestationTx } = await app.contracts.recordAttestation(
      assetId,
      payloadDigest,
      CLAUSES.INTAKE
    );

    await app.audit.log({
      action: CLAUSES.INTAKE,
      assetId,
      attestationId,
      txHash: attestationTx,
      payload: {
        affidavitId,
        docs: body.docs,
        notes: body.notes ?? null,
      },
    });

    return reply.status(201).send({
      assetId,
      affidavitId,
      attestationId,
      jurisdiction: JURISDICTION_TAG,
      txHashes: {
        custody: custodyTx,
        docs: docTxHashes,
        affidavit: affidavitTx,
        attestation: attestationTx,
      },
    });
  });
}
