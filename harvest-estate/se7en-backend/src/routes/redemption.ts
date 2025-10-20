import { FastifyInstance } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { computeNav } from '../treasury/nav';
import { quoteRedemption } from '../treasury/redemption';

const prisma = new PrismaClient();

const requestSchema = z.object({
  holderId: z.string().min(1),
  tokens: z.number().positive(),
});

export default async function redemptionRoutes(app: FastifyInstance) {
  app.post('/treasury/redeem', async (req, reply) => {
    const parseResult = requestSchema.safeParse(req.body);
    if (!parseResult.success) {
      reply.status(400);
      return { ok: false, error: 'invalid_payload', detail: parseResult.error.flatten() };
    }

    const { holderId, tokens } = parseResult.data;

    const [treasury, supply] = await Promise.all([
      prisma.treasuryState.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.tokenSupply.findFirst({ where: { symbol: 'HRVST' } }),
    ]);

    if (!treasury || !supply) {
      reply.status(400);
      return { ok: false, error: 'treasury_uninitialized' };
    }

    const alpha = Number(process.env.TREASURY_POLICY_ALPHA ?? 0.75);
    const spread = Number(process.env.TREASURY_POLICY_SPREAD_BPS ?? 50);

    const nav = computeNav({
      treasuryStableUsd: Number(treasury.stableUsd),
      insuredReservesUsd: Number(treasury.insuredReservesUsd),
      realizedYieldUsd: Number(treasury.realizedYieldUsd),
      liabilitiesUsd: Number(treasury.liabilitiesUsd),
      supply: Number(supply.circulating),
      alphaFloor: alpha,
      spreadBps: spread,
    });

    try {
      const quote = quoteRedemption({
        holderId,
        tokensRequested: tokens,
        availableSupply: Number(supply.circulating),
        stableUsd: Number(treasury.stableUsd),
        nav,
      });

      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.redemptionTicket.create({
          data: {
            holderId: quote.holderId,
            tokens: new Prisma.Decimal(quote.tokens),
            usdPaid: new Prisma.Decimal(quote.usdOwed),
            pricePerToken: new Prisma.Decimal(quote.pricePerToken),
          },
        });

        await tx.tokenSupply.update({
          where: { symbol: 'HRVST' },
          data: {
            circulating: new Prisma.Decimal(Number(supply.circulating) - quote.tokens),
          },
        });

        await tx.treasuryState.create({
          data: {
            stableUsd: new Prisma.Decimal(Math.max(0, Number(treasury.stableUsd) - quote.usdOwed)),
            insuredReservesUsd: treasury.insuredReservesUsd,
            realizedYieldUsd: treasury.realizedYieldUsd,
            liabilitiesUsd: treasury.liabilitiesUsd,
          },
        });

        return { ticket, quote };
      });

      return {
        ok: true,
        ticket: {
          id: result.ticket.id,
          holderId: result.ticket.holderId,
        },
        usdOwed: result.quote.usdOwed,
        price: result.quote.pricePerToken,
        navPerToken: result.quote.navPerToken,
      };
    } catch (err) {
      reply.status(400);
      if (err instanceof Error) {
        return { ok: false, error: err.message };
      }
      return { ok: false, error: 'unknown_error' };
    }
  });
}
