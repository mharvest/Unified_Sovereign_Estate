import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const supply = new Prisma.Decimal(1_000_000);
  const stable = new Prisma.Decimal(1_250_000);
  const insured = new Prisma.Decimal(750_000);
  const yieldUsd = new Prisma.Decimal(180_000);
  const liabilities = new Prisma.Decimal(120_000);

  await prisma.tokenSupply.upsert({
    where: { symbol: 'HRVST' },
    update: { circulating: supply },
    create: { symbol: 'HRVST', circulating: supply },
  });

  await prisma.treasuryState.create({
    data: {
      stableUsd: stable,
      insuredReservesUsd: insured,
      realizedYieldUsd: yieldUsd,
      liabilitiesUsd: liabilities,
    },
  });

  console.log('Demo treasury state and supply seeded.');
}

main()
  .catch((error) => {
    console.error('Failed to seed demo data', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
