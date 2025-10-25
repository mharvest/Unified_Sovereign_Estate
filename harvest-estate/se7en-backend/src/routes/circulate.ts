import type { FastifyInstance } from 'fastify';
import type { FiduciaryRole } from '@prisma/client';
import { z } from 'zod';
import { CLAUSES } from '../constants.js';
import { payloadHash } from '../lib/utils.js';
import { ensureContractsConfigured } from '../lib/addressGuard.js';

const CirculateSchema = z.object({
  noteId: z.union([z.string().min(1), z.number().int().nonnegative(), z.bigint()]),
  days: z.number().int().positive(),
  rateBps: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export default async function circulateRoutes(app: FastifyInstance) {
  app.post('/circulate', { preHandler: app.authorize(['TREASURY', 'OPS'] as FiduciaryRole[]) }, async (req, reply) => {
    const body = CirculateSchema.parse(req.body);

    if (!(await ensureContractsConfigured(app, reply, CLAUSES.CYCLE, { noteId: body.noteId }))) {
      return;
    }
    const noteId = typeof body.noteId === 'bigint' ? body.noteId : BigInt(body.noteId);

    const note = await app.contracts.getNote(noteId);

    const { cycleId, txHash } = await app.contracts.runCycle(noteId, body.days, body.rateBps);

    const payload = {
      noteId: noteId.toString(),
      cycleId,
      tenorDays: body.days,
      rateBps: body.rateBps,
      notes: body.notes ?? null,
    };

    const { attestationId, txHash: attestationTx } = await app.contracts.recordAttestation(
      note.assetId,
      payloadHash(payload),
      CLAUSES.CYCLE
    );

    await app.audit.log({
      action: CLAUSES.CYCLE,
      assetId: note.assetId,
      attestationId,
      txHash: attestationTx,
      payload,
    });

    return reply.status(201).send({
      cycleId,
      attestationId,
      txHashes: {
        cycle: txHash,
        attestation: attestationTx,
      },
    });
  });
}
