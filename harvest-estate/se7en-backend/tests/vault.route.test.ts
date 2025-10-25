import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/server.js';
import { createJwt, createStubContracts, MemoryAuditLogger, MemoryMailer, MemoryVaultRepository } from './stubs.js';

const FILE_CONTENT = Buffer.from('hello safevault');
const BASE64_CONTENT = FILE_CONTENT.toString('base64');

describe('POST /vault/upload', () => {
  const originalFlag = process.env.SAFEVAULT_UPLOADS_ENABLED;

  beforeEach(() => {
    process.env.SAFEVAULT_UPLOADS_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.SAFEVAULT_UPLOADS_ENABLED = originalFlag;
  });

  it('returns 503 when uploads are disabled', async () => {
    process.env.SAFEVAULT_UPLOADS_ENABLED = 'false';
    const app = buildApp({ contracts: createStubContracts(), audit: new MemoryAuditLogger() });
    const token = createJwt('LAW');

    const res = await app.inject({
      method: 'POST',
      url: '/vault/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        assetId: 'HASKINS-16315',
        fileName: 'doc.pdf',
        content: BASE64_CONTENT,
      },
    });

    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it('stores the document and sends a notification', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vault-'));
    const repo = new MemoryVaultRepository();
    const mailer = new MemoryMailer();

    const app = buildApp({
      contracts: createStubContracts(),
      audit: new MemoryAuditLogger(),
      vaultOptions: {
        enabled: true,
        storagePath: dir,
        repository: repo,
        mailer,
        defaultRecipients: ['ops@harvest.estate'],
      },
    });
    const token = createJwt('OPS');

    const res = await app.inject({
      method: 'POST',
      url: '/vault/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        assetId: 'HASKINS-16315',
        fileName: 'upload.pdf',
        content: BASE64_CONTENT,
        notify: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.sha256).toMatch(/^0x[0-9a-f]{64}$/);
    expect(repo.docs).toHaveLength(1);
    expect(repo.docs[0].sha256).toBe(body.sha256);
    expect(mailer.messages).toHaveLength(1);
    const storedDir = path.join(dir, repo.docs[0].assetId);
    const storedFiles = await readdir(storedDir);
    expect(storedFiles.some((file) => file.includes(repo.docs[0].name))).toBe(true);

    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('propagates notification errors', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vault-'));
    const repo = new MemoryVaultRepository();
    const mailer = new MemoryMailer();
    mailer.shouldFail = true;

    const app = buildApp({
      contracts: createStubContracts(),
      audit: new MemoryAuditLogger(),
      vaultOptions: {
        enabled: true,
        storagePath: dir,
        repository: repo,
        mailer,
        defaultRecipients: ['ops@harvest.estate'],
      },
    });
    const token = createJwt('LAW');

    const res = await app.inject({
      method: 'POST',
      url: '/vault/upload',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        assetId: 'HASKINS-16315',
        fileName: 'fail.pdf',
        content: BASE64_CONTENT,
        notify: true,
      },
    });

    expect(res.statusCode).toBe(502);
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });
});
