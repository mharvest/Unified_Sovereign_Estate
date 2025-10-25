import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.ledgerLog.deleteMany();
  await prisma.affidavit.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.insuranceBand.deleteMany();
  await prisma.issuance.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();

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

  const [law, cpa, treasuryUser, insuranceUser, ops, governance, oracle] = await Promise.all([
    prisma.user.create({
      data: { email: 'law@harvest.estate', displayName: 'Althea Chambers', role: 'LAW' },
    }),
    prisma.user.create({
      data: { email: 'cpa@harvest.estate', displayName: 'Jonas Patel', role: 'CPA' },
    }),
    prisma.user.create({
      data: { email: 'treasury@harvest.estate', displayName: 'Vera Holt', role: 'TREASURY' },
    }),
    prisma.user.create({
      data: { email: 'insurance@harvest.estate', displayName: 'Mara Kato', role: 'INSURANCE' },
    }),
    prisma.user.create({
      data: { email: 'ops@harvest.estate', displayName: 'Isa King', role: 'OPS' },
    }),
    prisma.user.create({
      data: { email: 'governance@harvest.estate', displayName: 'Pax Everett', role: 'GOVERNANCE' },
    }),
    prisma.user.create({
      data: { email: 'oracle@harvest.estate', displayName: 'Eido Relay', role: 'ORACLE' },
    }),
  ]);

  const haskins = await prisma.asset.create({
    data: {
      externalId: 'HAS-ALPHA',
      name: 'Haskins Alpha Estate',
      assetType: 'CSDN',
      jurisdiction: 'US-DE-TRUST',
      valuationUsd: new Prisma.Decimal('875000'),
      status: 'CIRCULATING',
    },
  });

  const beta = await prisma.asset.create({
    data: {
      externalId: 'MER-BETA',
      name: 'Meridian Beta IP Trust',
      assetType: 'SDN',
      jurisdiction: 'US-CA-IP',
      valuationUsd: new Prisma.Decimal('620000'),
      status: 'INSURED',
    },
  });

  const haskinsInsurance = await prisma.insuranceBand.create({
    data: {
      assetId: haskins.id,
      provider: 'Matriarch',
      multiplier: new Prisma.Decimal('3.5'),
      coverageUsd: new Prisma.Decimal('3062500'),
      policyJson: JSON.stringify({
        jurisdiction: 'US-DE',
        multiplier: '3.5x',
        coverageCurrency: 'USD',
        floor: 0.85,
      }),
    },
  });

  await prisma.insuranceBand.create({
    data: {
      assetId: beta.id,
      provider: 'Matriarch',
      multiplier: new Prisma.Decimal('2.8'),
      coverageUsd: new Prisma.Decimal('1736000'),
      policyJson: JSON.stringify({
        jurisdiction: 'US-CA',
        multiplier: '2.8x',
        coverageCurrency: 'USD',
        floor: 0.8,
      }),
    },
  });

  const haskinsIssuance = await prisma.issuance.create({
    data: {
      assetId: haskins.id,
      tokenSymbol: 'HRVST',
      quantity: new Prisma.Decimal('380038.75'),
      navPerToken: new Prisma.Decimal('0.91'),
      policyFloor: new Prisma.Decimal('0.85'),
      txHash: '0xHASKINSINTAKE',
    },
  });

  await prisma.issuance.create({
    data: {
      assetId: beta.id,
      tokenSymbol: 'HRVST',
      quantity: new Prisma.Decimal('248000.00'),
      navPerToken: new Prisma.Decimal('0.88'),
      policyFloor: new Prisma.Decimal('0.80'),
      txHash: '0xMERIDIANINTAKE',
    },
  });

  const haskinsAffidavitHash = createHash('sha256')
    .update('Haskins Alpha Estate|2024-07-01|Matriarch|US-DE')
    .digest('hex');

  const betaAffidavitHash = createHash('sha256')
    .update('Meridian Beta IP Trust|2024-07-01|Matriarch|US-CA')
    .digest('hex');

  await prisma.affidavit.create({
    data: {
      assetId: haskins.id,
      hash: haskinsAffidavitHash,
      jurisdiction: 'US-DE',
      clauseRef: 'EYEION-2024-ALPHA',
      issuedBy: 'Eyeion Legal Chain',
    },
  });

  await prisma.affidavit.create({
    data: {
      assetId: beta.id,
      hash: betaAffidavitHash,
      jurisdiction: 'US-CA',
      clauseRef: 'EYEION-2024-BETA',
      issuedBy: 'Eyeion Legal Chain',
    },
  });

  await prisma.transaction.createMany({
    data: [
      {
        assetId: haskins.id,
        issuanceId: haskinsIssuance.id,
        type: 'INTAKE',
        amountUsd: '875000',
        metadata: { step: 'Intake', actor: 'Se7en', notes: 'Collateral documents verified by SafeVault' },
      },
      {
        assetId: haskins.id,
        issuanceId: haskinsIssuance.id,
        type: 'INSURANCE_PREMIUM',
        amountUsd: '0',
        metadata: { step: 'Insurance', multiplier: '3.5x', provider: 'Matriarch' },
      },
      {
        assetId: haskins.id,
        issuanceId: haskinsIssuance.id,
        type: 'MINT',
        amountUsd: '380038.75',
        metadata: { step: 'Issuance', txHash: '0xHASKINSINTAKE' },
      },
      {
        assetId: haskins.id,
        issuanceId: haskinsIssuance.id,
        type: 'CIRCULATION',
        amountUsd: '360000',
        metadata: { step: 'Circulation', desk: 'Kiiantu', tenorDays: 90 },
      },
      {
        assetId: haskins.id,
        issuanceId: haskinsIssuance.id,
        type: 'REDEMPTION',
        amountUsd: '380038.75',
        metadata: { step: 'Redemption', payout: '380038.75', certification: 'Eyeion' },
      },
    ],
  });

  await prisma.ledgerLog.create({
    data: {
      scope: 'workflow:haskins-alpha',
      level: 'INFO',
      message: 'Matriarch multiplier 3.5x applied to Haskins Alpha Estate.',
      metadata: {
        multiplier: haskinsInsurance.multiplier.toString(),
        coverageUsd: haskinsInsurance.coverageUsd.toString(),
      },
      user: { connect: { id: insuranceUser.id } },
    },
  });

  await prisma.ledgerLog.create({
    data: {
      scope: 'workflow:haskins-alpha',
      level: 'INFO',
      message: 'Kïïantu desk circulated HRVST liquidity for Haskins Alpha.',
      metadata: { tenorDays: 90, amountUsd: '360000' },
      user: { connect: { id: treasuryUser.id } },
    },
  });

  await prisma.ledgerLog.create({
    data: {
      scope: 'workflow:beta-meridian',
      level: 'WARN',
      message: 'Meridian Beta awaiting Matriarch confirmation.',
      metadata: { requiredMultiplierFloor: '2.0x' },
      user: { connect: { id: governance.id } },
    },
  });

  console.log('Demo treasury state, assets, and workflow records seeded.');
}

main()
  .catch((error) => {
    console.error('Failed to seed demo data', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
// @ts-nocheck
