import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { keccak256, stringToHex } from 'viem';
import { missingToTodoList } from '../lib/requiredInputs.js';
import { prisma } from '../lib/prisma.js';
import { computeAssetId, registerCustody } from '../chain/safevault.js';
import { resolveActuarialClass, verifyActuarialHash } from '../lib/actuarial.js';
import { fetchSignedNavSnapshot, verifyNavSnapshot, payloadDigest } from '../lib/nav.js';

interface TodoResponse {
  ok: false;
  error: string;
  todos: string[];
  detail: string;
}

function buildTodoResponse(app: FastifyInstance, detail: string): TodoResponse {
  const state = app.reportMissingInputs();
  const todos = missingToTodoList([...state.missingBase, ...state.missingLive]);
  return {
    ok: false,
    error: 'preconditions_not_met',
    todos,
    detail,
  };
}

const IntakeSchema = z.object({
  assetLabel: z.string().min(1),
  docs: z
    .array(
      z.object({
        type: z.string().min(1),
        hash: z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/, 'Document hash must be 32-byte hex'),
      }),
    )
    .min(1),
  notes: z.string().optional(),
});

const IssuanceSchema = z.object({
  assetLabel: z.string().min(1),
  instrument: z.enum(['CSDN', 'SDN']),
  notionalUsd: z.string().regex(/^\d+(\.\d+)?$/),
  affidavitId: z.string().optional(),
  notes: z.string().optional(),
});

const InsuranceSchema = z.object({
  assetLabel: z.string().min(1),
  classCode: z.number().int().nonnegative(),
  disclosureMemo: z.string().optional(),
  notes: z.string().optional(),
});

const PegSchema = z.object({
  issuanceId: z.string().min(1),
  noteId: z.string().min(1),
  recipient: z.string().optional(),
});

const CycleArmSchema = z.object({
  noteId: z
    .string()
    .min(1)
    .regex(/^\d+$/, 'Note ID must be a base-10 integer string'),
  tenorDays: z.coerce.number().int().positive(),
  rateBps: z.coerce.number().int().nonnegative(),
});

export default async function operationsRoutes(app: FastifyInstance) {
  app.post('/intake', async (request, reply) => {
    try {
      await app.ensurePreconditions();
    } catch (error) {
      const response = buildTodoResponse(app, 'Custody intake pending required inputs.');
      return reply.status(428).send(response);
    }

    const input = IntakeSchema.parse(request.body);
    const assetId = computeAssetId(input.assetLabel);
    const docHashes = input.docs.map((doc) => doc.hash.toLowerCase());

    let custodyResult;
    try {
      custodyResult = await registerCustody({
        assetIdHex: assetId,
        docHashes,
      });
    } catch (error) {
      custodyResult = {
        skipped: true,
        signature: null,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: custodyResult.skipped ? 'INTAKE_SUBMITTED_WITH_WARNING' : 'INTAKE_SUBMITTED',
          assetId,
          attestationId: custodyResult.signature,
          txHash: custodyResult.signature,
          payload: {
            route: 'POST /intake',
            actor: request.user?.role ?? null,
            result: custodyResult.skipped ? 'warn' : 'ok',
            docHashes,
            notes: input.notes ?? null,
            custodyResult,
          },
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to persist intake audit log');
    }

    return reply.status(201).send({
      ok: true,
      assetId,
      custodyStatus: custodyResult.skipped ? 'submitted_with_warning' : 'registered',
      signature: custodyResult.signature,
      notes: input.notes ?? null,
      todo: custodyResult.reason ?? null,
    });
  });

  app.post('/issuance', async (request, reply) => {
    try {
      await app.ensurePreconditions();
    } catch (error) {
      const response = buildTodoResponse(app, 'Issuance blocked until prerequisites satisfied.');
      return reply.status(428).send(response);
    }

    const input = IssuanceSchema.parse(request.body);
    if (!app.contracts?.issueInstrument) {
      return reply.status(503).send(buildTodoResponse(app, 'Contracts gateway unavailable for issuance.'));
    }

    const assetId = computeAssetId(input.assetLabel);
    const par = BigInt(Math.round(Number(input.notionalUsd) * 1_000_000));

    let noteId: bigint | null = null;
    let attestationId: string | null = null;
    let txHash: string | null = null;
    let issueError: string | null = null;
    try {
      const result = await app.contracts.issueInstrument(
        input.instrument,
        assetId as `0x${string}`,
        par,
      );
      noteId = result.noteId;
      attestationId = result.attestationId;
      txHash = result.txHash;
    } catch (error) {
      issueError = error instanceof Error ? error.message : String(error);
    }

    const issuanceId = randomUUID();

    try {
      await prisma.auditLog.create({
        data: {
          action: issueError ? 'ISSUANCE_ATTEMPT_WITH_WARNING' : 'ISSUANCE_ATTEMPT',
          assetId,
          attestationId: attestationId ?? null,
          txHash,
          payload: {
            route: 'POST /issuance',
            actor: request.user?.role ?? null,
            result: issueError ? 'warn' : 'ok',
            instrument: input.instrument,
            notionalUsd: input.notionalUsd,
            issuanceId,
            noteId: noteId?.toString() ?? null,
            attestationId,
            txHash,
            issueError,
            notes: input.notes ?? null,
          },
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to persist issuance audit log');
    }

    if (issueError) {
      return reply.status(502).send({ ok: false, error: 'issuance_failed', detail: issueError });
    }

    return reply.status(201).send({
      ok: true,
      issuanceId,
      assetId,
      noteId: noteId?.toString() ?? null,
      attestationId,
      txHash,
      notes: input.notes ?? null,
    });
  });

  app.post('/insurance', async (request, reply) => {
    try {
      await app.ensurePreconditions();
    } catch (error) {
      const response = buildTodoResponse(app, 'Insurance binding requires missing prerequisites.');
      return reply.status(428).send(response);
    }

    try {
      await verifyActuarialHash();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(428).send(buildTodoResponse(app, `Actuarial tables invalid: ${message}`));
    }

    const input = InsuranceSchema.parse(request.body);
    const assetId = computeAssetId(input.assetLabel);
    let coverageClass;
    try {
      coverageClass = await resolveActuarialClass(input.classCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(400).send({ ok: false, error: 'unknown_class_code', detail: message });
    }

    const multiplierX = coverageClass.multiplier;
    const factorBps = BigInt(Math.round(multiplierX * 10_000));
    const disclosureHash = keccak256(
      stringToHex(
        input.disclosureMemo ?? `${coverageClass.code}:${coverageClass.multiplier}:${coverageClass.floorBps}`,
      ),
    );

    if (!app.contracts?.bindCoverage) {
      return reply.status(503).send(buildTodoResponse(app, 'Contracts gateway unavailable for Matriarch binding.'));
    }

    let binderId: string | null = null;
    let txHash: string | null = null;
    let bindError: string | null = null;
    try {
      const result = await app.contracts.bindCoverage(
        assetId as `0x${string}`,
        input.classCode,
        factorBps,
        disclosureHash,
      );
      binderId = result.binderId;
      txHash = result.txHash;
    } catch (error) {
      bindError = error instanceof Error ? error.message : String(error);
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: bindError ? 'INSURANCE_BINDING_WITH_WARNING' : 'INSURANCE_BINDING',
          assetId,
          attestationId: binderId,
          txHash,
          payload: {
            route: 'POST /insurance',
            actor: request.user?.role ?? null,
            result: bindError ? 'warn' : 'ok',
            classCode: input.classCode,
            coverageClass,
            disclosureHash,
            binderId,
            txHash,
            bindError,
            multiplier: multiplierX,
            factorBps: Number(factorBps),
            notes: input.notes ?? null,
          },
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to persist insurance audit log');
    }

    if (bindError) {
      return reply.status(502).send({
        ok: false,
        error: 'matriarch_bind_failed',
        detail: bindError,
      });
    }

    return reply.status(201).send({
      ok: true,
      assetId,
      binderId,
      txHash,
      multiplier: multiplierX,
      factorBps: Number(factorBps),
      coverageClass: coverageClass.code,
      notes: input.notes ?? null,
    });
  });

  app.post('/peg/mint', async (request, reply) => {
    try {
      await app.ensurePreconditions({ requireLiveReadiness: true });
    } catch (error) {
      const response = buildTodoResponse(app, 'Peg mint requires NAV oracle + custody evidence.');
      return reply.status(428).send(response);
    }

    if (!app.contracts?.mintByNav || !app.contracts?.getNote) {
      return reply.status(503).send(buildTodoResponse(app, 'Contracts gateway unavailable for minting.'));
    }

    const input = PegSchema.parse(request.body);

    const mockSnapshot = () => ({
      payload: {
        timestamp: Date.now(),
        navCsdn: '100000000000',
        navSdn: '50000000000',
        floorBps: 1000,
        price: '100000000000',
      },
      signature: Buffer.from('mock-nav-signature').toString('base64'),
    });

    const navEndpoint = process.env.NAV_FEED_ENDPOINT;
    let mockNav = navEndpoint === 'mock';
    let signedNav = mockNav ? mockSnapshot() : null;

    if (!signedNav) {
      try {
        signedNav = await fetchSignedNavSnapshot();
        verifyNavSnapshot(signedNav);
      } catch (error) {
        request.log.warn({ err: error }, 'Failed to fetch NAV snapshot – falling back to mock payload');
        signedNav = mockSnapshot();
        mockNav = true;
      }
    }

    const payload = signedNav.payload;
    const noteIdBigInt = BigInt(input.noteId);
    const note = await app.contracts.getNote(noteIdBigInt);
    if (!note || note.assetId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return reply.status(404).send({ ok: false, error: 'note_not_found' });
    }

    const navCsdn = BigInt(payload.navCsdn);
    const navSdn = BigInt(payload.navSdn);
    const floorBps = BigInt(payload.floorBps);
    const to = (input.recipient ?? app.contracts.operatorAddress) as `0x${string}`;

    let amount: bigint | null = null;
    let txHash: string | null = null;
    let mintError: string | null = null;
    try {
      const result = await app.contracts.mintByNav(navCsdn, navSdn, floorBps, to);
      amount = result.amount;
      txHash = result.txHash;
    } catch (error) {
      mintError = error instanceof Error ? error.message : String(error);
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: mintError ? 'PEG_MINT_WITH_WARNING' : 'PEG_MINT',
          assetId: note.assetId,
          attestationId: signedNav.signature,
          txHash,
          payload: {
            route: 'POST /peg/mint',
            actor: request.user?.role ?? null,
            result: mintError ? 'warn' : 'ok',
            issuanceId: input.issuanceId,
            noteId: input.noteId,
            navPayload: payload,
            payloadDigest: payloadDigest(payload),
            amount: amount?.toString() ?? null,
            txHash,
            mintError,
            recipient: to,
            navSource: mockNav ? 'mock' : navEndpoint,
          },
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to persist peg mint audit log');
    }

    if (mintError) {
      return reply.status(502).send({ ok: false, error: 'mint_failed', detail: mintError });
    }

    return reply.status(201).send({
      ok: true,
      issuanceId: input.issuanceId,
      noteId: input.noteId,
      assetId: note.assetId,
      amount: amount?.toString() ?? null,
      txHash,
      nav: payload,
      recipient: to,
      navSource: mockNav ? 'mock' : navEndpoint,
    });
  });

  app.post('/cycle/arm', async (request, reply) => {
    try {
      await app.ensurePreconditions();
    } catch (error) {
      const response = buildTodoResponse(app, 'Cycle arming requires prerequisite evidence.');
      return reply.status(428).send(response);
    }

    if (!app.contracts?.runCycle || !app.contracts?.getNote) {
      return reply
        .status(503)
        .send(buildTodoResponse(app, 'Contracts gateway unavailable for cycle orchestration.'));
    }

    const input = CycleArmSchema.parse(request.body ?? {});
    const noteIdBigInt = BigInt(input.noteId);

    const note = await app.contracts.getNote(noteIdBigInt);
    if (
      !note ||
      note.assetId === '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return reply.status(404).send({ ok: false, error: 'note_not_found' });
    }
    if (!note.active) {
      return reply.status(409).send({ ok: false, error: 'note_inactive' });
    }

    let cycleId: string | null = null;
    let txHash: string | null = null;
    let cycleError: string | null = null;
    try {
      const result = await app.contracts.runCycle(noteIdBigInt, input.tenorDays, input.rateBps);
      cycleId = result.cycleId;
      txHash = result.txHash;
    } catch (error) {
      cycleError = error instanceof Error ? error.message : String(error);
    }

    let cycleRecordId: string | null = null;
    try {
      const now = new Date();
      const cycleRecord = await prisma.cycle.create({
        data: {
          program: 'kiiantu',
          status: cycleError ? 'FAILED' : 'ARMED',
          noteId: noteIdBigInt,
          cycleId,
          tenorDays: input.tenorDays,
          rateBps: input.rateBps,
          operator: app.contracts.operatorAddress,
          txHash,
          armedAt: now,
          executedAt: null,
          failedAt: cycleError ? now : null,
          metadata: {
            actor: request.user?.role ?? null,
            cycleError,
          },
        },
      });
      cycleRecordId = cycleRecord.id;
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to persist cycle record');
    }

    try {
      await prisma.auditLog.create({
        data: {
          action: cycleError ? 'CYCLE_ARM_WITH_WARNING' : 'CYCLE_ARM',
          assetId: note.assetId,
          attestationId: null,
          txHash,
          payload: {
            route: 'POST /cycle/arm',
            actor: request.user?.role ?? null,
            result: cycleError ? 'warn' : 'ok',
            noteId: input.noteId,
            tenorDays: input.tenorDays,
            rateBps: input.rateBps,
            cycleId,
            txHash,
            cycleRecordId,
            cycleError,
            status: cycleError ? 'FAILED' : 'ARMED',
            operator: app.contracts.operatorAddress,
          },
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'Failed to persist cycle audit log');
    }

    if (cycleError) {
      return reply
        .status(502)
        .send({ ok: false, error: 'cycle_execution_failed', detail: cycleError });
    }

    return reply.status(201).send({
      ok: true,
      noteId: input.noteId,
      assetId: note.assetId,
      cycleId,
      txHash,
      tenorDays: input.tenorDays,
      rateBps: input.rateBps,
      cycleRecordId,
    });
  });

  app.post('/redeem', async (_request, reply) => {
    try {
      await app.ensurePreconditions({ requireLiveReadiness: true });
    } catch (error) {
      const response = buildTodoResponse(app, 'Redemption halted until live prerequisites satisfied.');
      return reply.status(428).send(response);
    }
    return reply.status(428).send(buildTodoResponse(app, 'VaultQuant redemption path pending Nav + affidavit enforcement.'));
  });

  app.get('/verify/:id', async (_request, reply) => {
    try {
      await app.ensurePreconditions();
    } catch (error) {
      const response = buildTodoResponse(app, 'Verification requires custody and affidavit inputs.');
      return reply.status(428).send(response);
    }
    return reply.status(428).send(buildTodoResponse(app, 'Verification bundle generation not yet implemented.'));
  });
}
