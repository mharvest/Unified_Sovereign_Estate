import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';

export interface VaultUploadInput {
  assetId: string;
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  notify?: boolean;
  recipients?: string[];
}

export interface VaultUploadResult {
  assetId: string;
  fileName: string;
  sha256: string;
  path: string;
}

export interface VaultRepository {
  createOrUpdateDoc(input: {
    assetId: string;
    name: string;
    sha256: string;
    status?: string;
  }): Promise<void>;
  close?: () => Promise<void>;
}

export interface Mailer {
  send(options: { to: string[]; subject: string; text: string; from?: string }): Promise<void>;
  close?: () => Promise<void>;
}

export interface VaultPluginOptions {
  enabled?: boolean;
  storagePath?: string;
  repository?: VaultRepository;
  mailer?: Mailer | null;
  defaultRecipients?: string[];
  defaultFrom?: string;
  notifyByDefault?: boolean;
}

export interface VaultContext {
  enabled: boolean;
  storagePath: string;
  saveDocument(input: VaultUploadInput): Promise<VaultUploadResult>;
}

export class VaultMailerError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = 'VaultMailerError';
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    vault: VaultContext;
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureHexPrefix(value: string): string {
  return value.startsWith('0x') ? value : `0x${value}`;
}

function createPrismaRepository(client?: PrismaClient): VaultRepository {
  const prisma = client ?? new PrismaClient();
  const ownsClient = !client;
  return {
    async createOrUpdateDoc({ assetId, name, sha256, status }) {
      await prisma.custodyDoc.upsert({
        where: { sha256 },
        update: {
          assetId,
          name,
          status: status ?? 'PENDING_SIGNATURE',
        },
        create: {
          id: randomUUID(),
          assetId,
          name,
          sha256,
          status: status ?? 'PENDING_SIGNATURE',
        },
      });
    },
    async close() {
      if (ownsClient) {
        await prisma.$disconnect();
      }
    },
  };
}

function createSmtpMailerFromEnv(): Mailer | null {
  const host = process.env.SAFEVAULT_SMTP_HOST;
  const url = process.env.SAFEVAULT_SMTP_URL;
  if (!host && !url) {
    return null;
  }

  if (url) {
    try {
      const parsed = new URL(url);
      return createSmtpMailer({
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === 'smtps:' ? 465 : 25)),
        secure: parsed.protocol === 'smtps:',
        username: parsed.username || undefined,
        password: parsed.password || undefined,
      });
    } catch (error) {
      throw new Error(`Invalid SAFEVAULT_SMTP_URL: ${(error as Error).message}`);
    }
  }

  return createSmtpMailer({
    host: host ?? '127.0.0.1',
    port: Number(process.env.SAFEVAULT_SMTP_PORT ?? 1025),
    secure: process.env.SAFEVAULT_SMTP_SECURE === 'true',
    username: process.env.SAFEVAULT_SMTP_USER || undefined,
    password: process.env.SAFEVAULT_SMTP_PASS || undefined,
  });
}

interface SmtpMailerOptions {
  host: string;
  port: number;
  secure?: boolean;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

function createSmtpMailer(options: SmtpMailerOptions): Mailer {
  const timeout = options.timeoutMs ?? 15_000;

  async function sendCommand(socket: net.Socket, command: string): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      socket.write(`${command}\r\n`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return readResponse(socket, timeout);
  }

  async function readResponse(socket: net.Socket, waitTimeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) {
          return;
        }
        const last = lines[lines.length - 1];
        if (/^\d{3} /.test(last)) {
          cleanup();
          resolve(buffer);
        }
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onTimeout = () => {
        cleanup();
        reject(new Error('SMTP response timeout'));
      };
      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('timeout', onTimeout);
      };
      socket.on('data', onData);
      socket.once('error', onError);
      socket.once('timeout', onTimeout);
      socket.setTimeout(waitTimeout);
    });
  }

  async function send({ to, subject, text, from }: { to: string[]; subject: string; text: string; from?: string }) {
    if (to.length === 0) {
      return;
    }

    const socket = net.createConnection({ host: options.host, port: options.port });
    try {
      await readResponse(socket, timeout); // server greeting
      await sendCommand(socket, `EHLO se7en-backend`);
      if (options.username) {
        await sendCommand(socket, 'AUTH LOGIN');
        await sendCommand(socket, Buffer.from(options.username).toString('base64'));
        await sendCommand(socket, Buffer.from(options.password ?? '').toString('base64'));
      }
      const fromAddress = from ?? 'vault@harvest.estate';
      await sendCommand(socket, `MAIL FROM:<${fromAddress}>`);
      for (const rcpt of to) {
        await sendCommand(socket, `RCPT TO:<${rcpt}>`);
      }
      await sendCommand(socket, 'DATA');
      const lines = [
        `Subject: ${subject}`,
        `From: ${fromAddress}`,
        `To: ${to.join(', ')}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="utf-8"',
        '',
        text,
        '',
        '.',
      ];
      await new Promise<void>((resolve, reject) => {
        socket.write(lines.join('\r\n'), (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await readResponse(socket, timeout);
      await sendCommand(socket, 'QUIT');
    } finally {
      socket.end();
    }
  }

  return {
    send,
    async close() {
      // nothing to close for raw sockets
    },
  };
}

export default fp<VaultPluginOptions>(async function vaultPlugin(app: FastifyInstance, opts) {
  const enabled = opts?.enabled ?? (process.env.SAFEVAULT_UPLOADS_ENABLED ?? 'false').toLowerCase() === 'true';
  const storagePath = opts?.storagePath ?? process.env.SAFEVAULT_STORAGE_PATH ?? path.resolve(process.cwd(), 'var/safevault');
  const repository: VaultRepository =
    opts?.repository ??
    (enabled
      ? createPrismaRepository()
      : {
          async createOrUpdateDoc() {},
          async close() {},
        });
  const mailer = opts?.mailer !== undefined ? opts.mailer : createSmtpMailerFromEnv();
  const defaultRecipients = opts?.defaultRecipients ?? (process.env.SAFEVAULT_NOTIFICATION_TO?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? []);
  const defaultFrom = opts?.defaultFrom ?? process.env.SAFEVAULT_NOTIFICATION_FROM ?? 'vault@harvest.estate';
  const notifyByDefault = opts?.notifyByDefault ?? (process.env.SAFEVAULT_NOTIFY?.toLowerCase() ?? 'true') !== 'false';

  await fs.mkdir(storagePath, { recursive: true });

  async function saveDocument(input: VaultUploadInput): Promise<VaultUploadResult> {
    const filename = sanitizeFileName(input.fileName);
    const assetDir = path.resolve(storagePath, input.assetId);
    await fs.mkdir(assetDir, { recursive: true });
    const sha = createHash('sha256').update(input.buffer).digest('hex');
    const shaHex = ensureHexPrefix(sha);
    const filePath = path.join(assetDir, `${Date.now()}_${filename}`);
    await fs.writeFile(filePath, input.buffer);

    await repository.createOrUpdateDoc({
      assetId: input.assetId,
      name: filename,
      sha256: shaHex,
    });

    const shouldNotify = mailer && (input.notify ?? notifyByDefault);
    const recipients = input.recipients && input.recipients.length > 0 ? input.recipients : defaultRecipients;
    if (shouldNotify && recipients.length > 0 && mailer) {
      const subject = `SafeVault upload recorded for ${input.assetId}`;
      const text = `A document named "${input.fileName}" was uploaded for asset ${input.assetId}.\n\nSHA-256: ${shaHex}`;
      try {
        await mailer.send({ to: recipients, subject, text, from: defaultFrom });
      } catch (error) {
        throw new VaultMailerError((error as Error).message || 'mail_failed');
      }
    }

    return {
      assetId: input.assetId,
      fileName: filename,
      sha256: shaHex,
      path: filePath,
    };
  }

  app.decorate('vault', {
    enabled,
    storagePath,
    saveDocument,
  });

  app.addHook('onClose', async () => {
    await repository.close?.();
    await mailer?.close?.();
  });
});
