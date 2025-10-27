import { TextEncoder } from 'node:util';
import { createHash } from 'node:crypto';
import nacl from 'tweetnacl';

export interface NavSnapshotPayload {
  timestamp: number;
  navCsdn: string;
  navSdn: string;
  floorBps: number;
  price: string;
}

export interface SignedNavSnapshot {
  payload: NavSnapshotPayload;
  signature: string;
}

function encoder(): TextEncoder {
  return new TextEncoder();
}

function getEndpoint(): string {
  const url = process.env.NAV_FEED_ENDPOINT;
  if (!url) {
    throw new Error('NAV_FEED_ENDPOINT not configured');
  }
  return url;
}

function getPublicKey(): Uint8Array {
  const base64 = process.env.NAV_FEED_SIGNING_PUBKEY;
  if (!base64) {
    throw new Error('NAV_FEED_SIGNING_PUBKEY missing');
  }
  return Buffer.from(base64, 'base64');
}

export async function fetchSignedNavSnapshot(): Promise<SignedNavSnapshot> {
  const response = await fetch(getEndpoint(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch NAV snapshot: ${response.status}`);
  }
  const data = (await response.json()) as SignedNavSnapshot;
  return data;
}

export function verifyNavSnapshot(snapshot: SignedNavSnapshot): void {
  const publicKey = getPublicKey();
  const message = encoder().encode(JSON.stringify(snapshot.payload));
  const signature = Buffer.from(snapshot.signature, 'base64');
  const ok = nacl.sign.detached.verify(message, signature, publicKey);
  if (!ok) {
    throw new Error('NAV snapshot signature invalid');
  }
}

export function payloadDigest(payload: NavSnapshotPayload): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(payload));
  return `0x${hash.digest('hex')}`;
}
