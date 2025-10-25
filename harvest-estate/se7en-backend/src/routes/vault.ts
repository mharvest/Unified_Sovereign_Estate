import type { FastifyInstance } from 'fastify';
import type { FiduciaryRole } from '@prisma/client';
import { z } from 'zod';
import { labelToAssetId } from '../lib/utils.js';
import { VaultMailerError } from '../plugins/vault.js';

const UploadSchema = z.object({
  assetId: z.string().min(1),
  fileName: z.string().min(1),
  content: z.string().min(1),
  encoding: z.enum(['base64']).default('base64'),
  mimeType: z.string().optional(),
  notify: z.boolean().optional(),
  recipients: z.array(z.string().email()).optional(),
});

export default async function vaultRoutes(app: FastifyInstance) {
  app.post(
    '/vault/upload',
    { preHandler: app.authorize(['LAW', 'OPS'] as FiduciaryRole[]) },
    async (request, reply) => {
      if (!app.vault.enabled) {
        return reply.code(503).send({ ok: false, error: 'vault_disabled' });
      }

      const body = UploadSchema.parse(request.body);
      const assetHex = body.assetId.startsWith('0x') ? body.assetId : labelToAssetId(body.assetId);

      let buffer: Buffer;
      try {
        buffer = Buffer.from(body.content, body.encoding);
      } catch (error) {
        return reply.code(400).send({ ok: false, error: 'invalid_content_encoding' });
      }

      if (buffer.length === 0) {
        return reply.code(400).send({ ok: false, error: 'empty_payload' });
      }

      try {
        const result = await app.vault.saveDocument({
          assetId: assetHex,
          fileName: body.fileName,
          buffer,
          mimeType: body.mimeType,
          notify: body.notify,
          recipients: body.recipients,
        });

        let docTx: string | undefined;
        if (app.contracts) {
          docTx = await app.contracts.setDoc(result.assetId as `0x${string}`, result.sha256 as `0x${string}`);
        }

        await app.audit?.log({
          action: 'SAFEVAULT_UPLOAD',
          assetId: result.assetId,
          attestationId: null,
          txHash: docTx ?? null,
          payload: {
            fileName: result.fileName,
            sha256: result.sha256,
            mimeType: body.mimeType ?? null,
          },
        });

        return reply.code(201).send({
          ok: true,
          sha256: result.sha256,
          assetId: result.assetId,
          txHash: docTx ?? null,
        });
      } catch (error) {
        request.log.error({ err: error }, 'failed to store SafeVault document');
        if (error instanceof VaultMailerError) {
          return reply.code(502).send({ ok: false, error: 'notification_failed' });
        }
        return reply.code(500).send({ ok: false, error: 'upload_failed' });
      }
    },
  );
}
