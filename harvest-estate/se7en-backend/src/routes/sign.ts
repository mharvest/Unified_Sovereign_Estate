import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { FiduciaryRole } from '../plugins/auth.js';

const RecipientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
});

const DocumentSchema = z.object({
  name: z.string().min(1),
  sha256: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

const EnvelopeRequestSchema = z.object({
  assetId: z.string().min(1),
  type: z.string().min(1).default('STANDARD'),
  subject: z.string().optional(),
  message: z.string().optional(),
  recipients: z.array(RecipientSchema).min(1),
  documents: z.array(DocumentSchema).optional(),
});

const WebhookEventSchema = z.object({
  envelopeId: z.string().min(1),
  status: z.string().min(1),
  signerEmail: z.string().email().optional(),
  signedAt: z.string().datetime().optional(),
  event: z.object({
    eventId: z.string().min(1),
    type: z.string().min(1),
    occurredAt: z.string().datetime(),
  }),
});

function computeEnvelopeDigest(payload: z.infer<typeof EnvelopeRequestSchema>): string {
  const digest = createHash('sha256').update(
    JSON.stringify({
      assetId: payload.assetId,
      recipients: payload.recipients,
      documents: payload.documents ?? [],
    }),
  );
  return digest.digest('hex');
}

export default async function signRoutes(app: FastifyInstance) {
  app.post(
    '/sign/envelope',
    { preHandler: app.authorize(['LAW', 'OPS'] as FiduciaryRole[]) },
    async (request, reply) => {
      if (!app.signing.enabled) {
        return reply.code(503).send({ ok: false, error: 'signing_disabled' });
      }

      const body = EnvelopeRequestSchema.parse(request.body);
      const result = await app.signing.provider.createEnvelope(body);

      await app.signing.store.createEnvelope({
        envelopeId: result.envelopeId,
        provider: app.signing.provider.name,
        type: body.type,
        assetId: body.assetId,
        status: result.status,
        sha256: computeEnvelopeDigest(body),
        signerEmail: result.signerEmail ?? body.recipients[0]?.email ?? null,
        signedAt: result.signedAt ?? null,
      });

      return reply.code(201).send({
        ok: true,
        envelopeId: result.envelopeId,
        status: result.status,
      });
    },
  );

  app.post('/sign/webhook', async (request, reply) => {
    if (!app.signing.enabled) {
      return reply.code(503).send({ ok: false, error: 'signing_disabled' });
    }

    const signatureHeader = request.headers['x-docusign-signature-1'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (
      app.signing.provider.verifyWebhookSignature &&
      (!signature || !request.rawBody || !app.signing.provider.verifyWebhookSignature(request.rawBody, signature))
    ) {
      return reply.code(401).send({ ok: false, error: 'invalid_signature' });
    }

    const body = WebhookEventSchema.parse(request.body);

    await app.signing.store.updateEnvelopeStatus(
      body.envelopeId,
      body.status,
      body.signedAt ? new Date(body.signedAt) : null,
      body.signerEmail ?? null,
    );

    await app.signing.store.recordEvent({
      envelopeId: body.envelopeId,
      providerEvent: body.event.type,
      eventType: body.status,
      signer: body.signerEmail ?? null,
      occurredAt: new Date(body.event.occurredAt),
      rawPayload: body,
    });

    return reply.code(204).send();
  });
}
