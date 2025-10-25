import type { FastifyInstance } from 'fastify';
import type { FiduciaryRole } from '@prisma/client';
import { z } from 'zod';
import { CLAUSES } from '../constants.js';
import {
  actionHash,
  labelToAssetId,
  normalizeBytes32,
  parseAmountWei,
  payloadHash,
} from '../lib/utils.js';
import { ACTION_NAMES } from '../constants.js';
import { ensureContractsConfigured } from '../lib/addressGuard.js';

const MintSchema = z.object({
  instrument: z.enum(['CSDN', 'SDN']),
  assetLabel: z.string().min(1),
  par: z.string().min(1),
  affidavitId: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  notes: z.string().optional(),
});

export default async function mintRoutes(app: FastifyInstance) {
  app.post('/mint', { preHandler: app.authorize(['TREASURY', 'OPS'] as FiduciaryRole[]) }, async (req, reply) => {
    const body = MintSchema.parse(req.body);
    if (!(await ensureContractsConfigured(app, reply, CLAUSES.ISSUANCE, { assetLabel: body.assetLabel }))) {
      return;
    }
    const assetId = labelToAssetId(body.assetLabel);
    const parWei = parseAmountWei(body.par);

    const hasCustody = await app.contracts.hasCustody(assetId);
    if (!hasCustody) {
      return reply.status(409).send({ ok: false, error: 'custody_required' });
    }

    const affidavitId = body.affidavitId
      ? normalizeBytes32(body.affidavitId, 'affidavitId')
      : await app.contracts.latestAffidavit(assetId);

    if (affidavitId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return reply.status(409).send({ ok: false, error: 'affidavit_missing' });
    }

    const isAllowed = await app.contracts.animaOk(assetId, actionHash(ACTION_NAMES.ISSUANCE));
    if (!isAllowed) {
      return reply.status(409).send({ ok: false, error: 'anima_blocked' });
    }

    const { noteId, txHash: issuanceTx } = await app.contracts.issueInstrument(
      body.instrument,
      assetId,
      parWei
    );

    const payload = {
      instrument: body.instrument,
      noteId: noteId.toString(),
      par: parWei.toString(),
      affidavitId,
      notes: body.notes ?? null,
    };

    const payloadDigest = payloadHash(payload);
    const { attestationId, txHash: attestationTx } = await app.contracts.recordAttestation(
      assetId,
      payloadDigest,
      CLAUSES.ISSUANCE
    );

    await app.contracts.updateNoteAttestation(noteId, attestationId);

    await app.audit.log({
      action: CLAUSES.ISSUANCE,
      assetId,
      attestationId,
      txHash: attestationTx,
      payload,
    });

    return reply.status(201).send({
      noteId: noteId.toString(),
      attestationId,
      affidavitId,
      txHashes: {
        issuance: issuanceTx,
        attestation: attestationTx,
      },
    });
  });
}
