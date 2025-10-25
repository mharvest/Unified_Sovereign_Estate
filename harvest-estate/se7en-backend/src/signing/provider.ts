import { randomUUID } from 'node:crypto';

export interface EnvelopeRecipient {
  name: string;
  email: string;
  role: string;
}

export interface EnvelopeDocument {
  name: string;
  sha256: string;
}

export interface CreateEnvelopeRequest {
  assetId?: string;
  type?: string;
  subject?: string;
  message?: string;
  recipients: EnvelopeRecipient[];
  documents?: EnvelopeDocument[];
}

export interface CreateEnvelopeResult {
  envelopeId: string;
  status: string;
  signerEmail?: string;
  signedAt?: Date;
}

export interface SigningProvider {
  name: string;
  createEnvelope(request: CreateEnvelopeRequest): Promise<CreateEnvelopeResult>;
  verifyWebhookSignature?(rawBody: string, signature: string): boolean;
}

function createStubProvider(): SigningProvider {
  return {
    name: 'STUB',
    async createEnvelope(request) {
      const envelopeId = `env_${randomUUID().replace(/-/g, '')}`;
      return {
        envelopeId,
        status: 'SENT',
        signerEmail: request.recipients[0]?.email,
      };
    },
    verifyWebhookSignature: () => true,
  };
}

export function createSigningProviderFromEnv(): SigningProvider {
  const provider = (process.env.SIGN_PROVIDER ?? 'STUB').toUpperCase();
  switch (provider) {
    case 'STUB':
      return createStubProvider();
    case 'DOCUSIGN':
      // Placeholder for future DocuSign integration
      return createStubProvider();
    default:
      return createStubProvider();
  }
}
