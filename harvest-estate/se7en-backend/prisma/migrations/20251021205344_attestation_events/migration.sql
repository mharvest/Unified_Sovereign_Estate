-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CSDN', 'SDN');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('INTAKE', 'VERIFIED', 'INSURED', 'ISSUED', 'CIRCULATING', 'REDEEMED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INTAKE', 'MINT', 'INSURANCE_PREMIUM', 'NAV_UPDATE', 'REDEMPTION', 'CIRCULATION');

-- CreateEnum
CREATE TYPE "FiduciaryRole" AS ENUM ('LAW', 'CPA', 'TREASURY', 'INSURANCE', 'OPS', 'GOVERNANCE', 'ORACLE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "TreasuryState" (
    "id" SERIAL NOT NULL,
    "stableUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "insuredReservesUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "realizedYieldUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "liabilitiesUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenSupply" (
    "symbol" TEXT NOT NULL,
    "circulating" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenSupply_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "RedemptionTicket" (
    "id" SERIAL NOT NULL,
    "holderId" TEXT NOT NULL,
    "tokens" DECIMAL(65,30) NOT NULL,
    "usdPaid" DECIMAL(65,30) NOT NULL,
    "pricePerToken" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedemptionTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "valuationUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "AssetStatus" NOT NULL DEFAULT 'INTAKE',
    "intakeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issuance" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "navPerToken" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "policyFloor" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "txHash" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceBand" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "multiplier" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "coverageUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "policyJson" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER,
    "issuanceId" INTEGER,
    "type" "TransactionType" NOT NULL,
    "amountUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affidavit" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "clauseRef" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affidavit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "FiduciaryRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerLog" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "LedgerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "attestationId" TEXT,
    "txHash" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttestationEvent" (
    "id" TEXT NOT NULL,
    "eventUid" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "juraHash" TEXT NOT NULL,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttestationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyDoc" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriberCursor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastBlock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriberCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureEnvelope" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "assetId" TEXT,
    "status" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureEvent" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "providerEvent" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signer" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "SignatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_externalId_key" ON "Asset"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Issuance_assetId_tokenSymbol_key" ON "Issuance"("assetId", "tokenSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceBand_assetId_provider_key" ON "InsuranceBand"("assetId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Affidavit_hash_key" ON "Affidavit"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AttestationEvent_eventUid_key" ON "AttestationEvent"("eventUid");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyDoc_sha256_key" ON "CustodyDoc"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriberCursor_name_key" ON "SubscriberCursor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureEnvelope_envelopeId_key" ON "SignatureEnvelope"("envelopeId");

-- AddForeignKey
ALTER TABLE "Issuance" ADD CONSTRAINT "Issuance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceBand" ADD CONSTRAINT "InsuranceBand_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_issuanceId_fkey" FOREIGN KEY ("issuanceId") REFERENCES "Issuance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affidavit" ADD CONSTRAINT "Affidavit_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerLog" ADD CONSTRAINT "LedgerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

