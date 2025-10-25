import { PrismaClient, Prisma } from '@prisma/client';

export interface EnvelopeRecordInput {
  envelopeId: string;
  provider: string;
  type: string;
  assetId?: string;
  status: string;
  sha256: string;
  signerEmail?: string | null;
  signedAt?: Date | null;
}

export interface EventRecordInput {
  envelopeId: string;
  providerEvent: string;
  eventType: string;
  signer: string | null;
  occurredAt: Date;
  rawPayload: unknown;
}

export interface SignatureStore {
  createEnvelope(input: EnvelopeRecordInput): Promise<void>;
  updateEnvelopeStatus(envelopeId: string, status: string, signedAt?: Date | null, signerEmail?: string | null): Promise<void>;
  recordEvent(input: EventRecordInput): Promise<void>;
  close?(): Promise<void>;
}

export function createPrismaSignatureStore(prismaClient?: PrismaClient): SignatureStore {
  const prisma = prismaClient ?? new PrismaClient();

  return {
    async createEnvelope(input) {
      await prisma.signatureEnvelope.upsert({
        where: { envelopeId: input.envelopeId },
        update: {
          provider: input.provider,
          type: input.type,
          assetId: input.assetId ?? null,
          status: input.status,
          sha256: input.sha256,
          signerEmail: input.signerEmail ?? null,
          signedAt: input.signedAt ?? null,
        },
        create: {
          envelopeId: input.envelopeId,
          provider: input.provider,
          type: input.type,
          assetId: input.assetId ?? null,
          status: input.status,
          sha256: input.sha256,
          signerEmail: input.signerEmail ?? null,
          signedAt: input.signedAt ?? null,
        },
      });
    },

    async updateEnvelopeStatus(envelopeId, status, signedAt, signerEmail) {
      try {
        await prisma.signatureEnvelope.update({
          where: { envelopeId },
          data: {
            status,
            signedAt: signedAt ?? null,
            signerEmail: signerEmail ?? null,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          // If the envelope is missing, create a placeholder
          await prisma.signatureEnvelope.create({
            data: {
              envelopeId,
              provider: 'UNKNOWN',
              type: 'UNKNOWN',
              assetId: null,
              status,
              sha256: '',
              signerEmail: signerEmail ?? null,
              signedAt: signedAt ?? null,
            },
          });
          return;
        }
        throw error;
      }
    },

    async recordEvent(input) {
      await prisma.signatureEvent.create({
        data: {
          envelopeId: input.envelopeId,
          providerEvent: input.providerEvent,
          eventType: input.eventType,
          signer: input.signer,
          occurredAt: input.occurredAt,
          rawPayload: input.rawPayload as Prisma.JsonObject,
        },
      });
    },

    async close() {
      if (!prismaClient) {
        await prisma.$disconnect();
      }
    },
  };
}
