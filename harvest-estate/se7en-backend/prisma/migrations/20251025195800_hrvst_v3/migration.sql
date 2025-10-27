-- CreateTable
CREATE TABLE "AttestationEvent" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockTime" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttestationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affidavit" (
    "id" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "eyeionHash" TEXT NOT NULL,
    "eklesiaHash" TEXT NOT NULL,
    "safeVaultCid" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affidavit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "cid" TEXT,
    "registeredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyDoc" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issuance" (
    "id" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "underlyingId" TEXT NOT NULL,
    "notionalUSD" DECIMAL(65,30) NOT NULL,
    "hrvstMinted" DECIMAL(65,30) NOT NULL,
    "eklesiaHash" TEXT,
    "affidavitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceBind" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "issuanceId" TEXT,
    "multiplierX" DECIMAL(65,30) NOT NULL,
    "matriarchHash" TEXT,
    "coverageClass" TEXT NOT NULL,
    "factorBps" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceBind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PegMint" (
    "id" TEXT NOT NULL,
    "issuanceId" TEXT NOT NULL,
    "hrvstAmount" DECIMAL(65,30) NOT NULL,
    "navAtMint" DECIMAL(65,30) NOT NULL,
    "oracleSig" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PegMint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "SubscriberCursor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "RequiredInput" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequiredInput_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "EvidenceTask" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustodyRecord_sha256_key" ON "CustodyRecord"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyDoc_sha256_key" ON "CustodyDoc"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriberCursor_name_key" ON "SubscriberCursor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureEnvelope_envelopeId_key" ON "SignatureEnvelope"("envelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceTask_key_key" ON "EvidenceTask"("key");

-- AddForeignKey
ALTER TABLE "PegMint" ADD CONSTRAINT "PegMint_issuanceId_fkey" FOREIGN KEY ("issuanceId") REFERENCES "Issuance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureEvent" ADD CONSTRAINT "SignatureEvent_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "SignatureEnvelope"("envelopeId") ON DELETE RESTRICT ON UPDATE CASCADE;
