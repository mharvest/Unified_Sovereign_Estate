import type { FastifyInstance } from 'fastify';
import type { FiduciaryRole } from '@prisma/client';
import { z } from 'zod';
import { CLAUSES, JURISDICTION_TAG } from '../constants.js';
import {
  actionHash,
  encodeJson,
  nowSeconds,
  payloadHash,
  parseAmountWei,
} from '../lib/utils.js';
import { ACTION_NAMES } from '../constants.js';
import { ensureContractsConfigured } from '../lib/addressGuard.js';

const RedeemSchema = z.object({
  noteId: z.union([z.string().min(1), z.number().int().nonnegative(), z.bigint()]),
  amount: z.union([z.string(), z.number(), z.bigint()]),
  holder: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  notes: z.string().optional(),
});

const REDEMPTION_CLAUSE = 'Redemption Certificate';

export default async function redeemRoutes(app: FastifyInstance) {
  app.post('/redeem', { preHandler: app.authorize(['TREASURY'] as FiduciaryRole[]) }, async (req, reply) => {
    const body = RedeemSchema.parse(req.body);
    if (!(await ensureContractsConfigured(app, reply, CLAUSES.REDEMPTION, { noteId: body.noteId }))) {
      return;
    }
    const noteId = typeof body.noteId === 'bigint' ? body.noteId : BigInt(body.noteId);
    const amountWei = parseAmountWei(body.amount);
    const holder = (body.holder ?? app.contracts.operatorAddress) as `0x${string}`;

    const note = await app.contracts.getNote(noteId);
    if (!note.active) {
      return reply.status(409).send({ ok: false, error: 'note_inactive' });
    }

    const allowed = await app.contracts.animaOk(note.assetId, actionHash(ACTION_NAMES.REDEMPTION));
    if (!allowed) {
      return reply.status(409).send({ ok: false, error: 'anima_blocked' });
    }

    const burnTx = await app.contracts.burnFrom(holder, amountWei);
    const settleTx = await app.contracts.settleRedemption(noteId, amountWei);

    const certificateMeta = {
      assetId: note.assetId,
      docHash: payloadHash({ noteId: noteId.toString(), amount: amountWei.toString() }),
      jurisdiction: JURISDICTION_TAG,
      clause: REDEMPTION_CLAUSE,
      ts: nowSeconds(),
      witness: app.contracts.operatorAddress,
      notes: body.notes ?? '',
    };

    const { affidavitId, txHash: affidavitTx } = await app.contracts.createAffidavit(
      note.assetId,
      encodeJson(certificateMeta)
    );

    const payload = {
      noteId: noteId.toString(),
      amount: amountWei.toString(),
      holder,
      affidavitId,
    };

    const { attestationId, txHash: attestationTx } = await app.contracts.recordAttestation(
      note.assetId,
      payloadHash(payload),
      CLAUSES.REDEMPTION
    );

    await app.contracts.updateNoteAttestation(noteId, attestationId);

    await app.audit.log({
      action: CLAUSES.REDEMPTION,
      assetId: note.assetId,
      attestationId,
      txHash: attestationTx,
      payload,
    });

    const aggregateNav = await app.contracts.getAggregateNav();

    return reply.status(201).send({
      attestationId,
      affidavitId,
      noteId: noteId.toString(),
      nav: {
        csdn: aggregateNav.navCsdn.toString(),
        sdn: aggregateNav.navSdn.toString(),
      },
      txHashes: {
        burn: burnTx,
        settle: settleTx,
        affidavit: affidavitTx,
        attestation: attestationTx,
      },
    });
  });
}
