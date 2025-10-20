import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { computeNav } from '../treasury/nav';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const ALPHA = Number(process.env.TREASURY_POLICY_ALPHA ?? 0.75);
const SPREAD_BPS = Number(process.env.TREASURY_POLICY_SPREAD_BPS ?? 50);

async function readSnapshot() {
  const [treasury, supply, latestTicket] = await Promise.all([
    prisma.treasuryState.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.tokenSupply.findFirst({ where: { symbol: 'HRVST' } }),
    prisma.redemptionTicket.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

  if (!treasury || !supply) {
    return {
      ok: false,
      reason: 'treasury_or_supply_missing',
      navPerToken: 0,
      floor: 0,
      price: 0,
      eyeionHash: null as string | null,
      pools: {
        stable: 0,
        insured: 0,
        yield: 0,
        liab: 0,
        supply: 0,
      },
    };
  }

  const navResult = computeNav({
    treasuryStableUsd: Number(treasury.stableUsd),
    insuredReservesUsd: Number(treasury.insuredReservesUsd),
    realizedYieldUsd: Number(treasury.realizedYieldUsd),
    liabilitiesUsd: Number(treasury.liabilitiesUsd),
    supply: Number(supply.circulating),
    alphaFloor: ALPHA,
    spreadBps: SPREAD_BPS,
  });

  const eyeionHash =
    latestTicket != null
      ? createHash('sha256')
          .update(
            [
              latestTicket.id,
              latestTicket.holderId,
              latestTicket.tokens.toString(),
              latestTicket.usdPaid.toString(),
              latestTicket.pricePerToken.toString(),
              latestTicket.createdAt.toISOString(),
            ].join('|'),
          )
          .digest('hex')
      : null;

  return {
    ok: true,
    navPerToken: navResult.navPerToken,
    floor: navResult.floor,
    price: navResult.price,
    eyeionHash,
    pools: {
      stable: Number(treasury.stableUsd),
      insured: Number(treasury.insuredReservesUsd),
      yield: Number(treasury.realizedYieldUsd),
      liab: Number(treasury.liabilitiesUsd),
      supply: Number(supply.circulating),
    },
  };
}

export default async function navRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ ok: true, service: 'se7en' }));

  app.get('/api/nav', async () => ({ ts: Date.now(), ...(await readSnapshot()) }));

  app.get('/api/nav/preview', async (req, reply) => {
    const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': originHeader ?? '*',
    });
    reply.hijack();

    const write = async () => {
      try {
        const payload = await readSnapshot();
        reply.raw.write(`data: ${JSON.stringify({ ts: Date.now(), ...payload })}\n\n`);
      } catch (error) {
        reply.log.error({ error }, 'failed to publish nav snapshot');
      }
    };

    await write();
    const interval = setInterval(write, 3000);

    req.raw.on('close', () => {
      clearInterval(interval);
    });
  });
}
