#!/usr/bin/env tsx

import 'dotenv/config';
import { randomUUID } from 'node:crypto';

const apiUrl =
  process.env.SAFEVAULT_API_URL ??
  process.env.SE7EN_API_URL ??
  process.env.SEVEN_API_URL ??
  'http://localhost:4000';
const token =
  process.env.SAFEVAULT_UPLOAD_JWT ??
  process.env.SE7EN_DEMO_JWT ??
  process.env.SEVEN_DEMO_JWT;

if (!token) {
  console.error('Missing JWT. Set SE7EN_DEMO_JWT or SAFEVAULT_UPLOAD_JWT before running this demo.');
  process.exit(1);
}

const assetLabel = process.env.SAFEVAULT_DEMO_ASSET ?? 'HASKINS-16315';
const mimeType = process.env.SAFEVAULT_DEMO_MIME ?? 'text/plain';

const now = new Date();
const payload = {
  assetId: assetLabel,
  fileName: `safevault-demo-${now.toISOString().replace(/[:.]/g, '-')}.txt`,
  content: Buffer.from(
    [
      'Harvest Estate SafeVault Demo Upload',
      `Asset Label: ${assetLabel}`,
      `Timestamp: ${now.toISOString()}`,
      `Run ID: ${randomUUID()}`,
    ].join('\n'),
    'utf8',
  ).toString('base64'),
  encoding: 'base64',
  mimeType,
  notify: true,
};

async function main() {
  console.log(`📤 Uploading demo document for asset "${assetLabel}"...`);

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/vault/upload`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    console.error(`❌ Upload failed (${response.status}): ${text}`);
    process.exit(1);
  }

  const body = await response.json();
  console.log('✅ SafeVault upload complete');
  console.table(body);
  console.log('📬 MailHog inbox: http://localhost:8025');
}

main().catch((error) => {
  console.error('SafeVault demo encountered an error:', error);
  process.exit(1);
});
