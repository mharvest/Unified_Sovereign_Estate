import { z } from 'zod';

const BASE_URL = process.env.NEXT_PUBLIC_SE7EN_API_URL ?? 'http://localhost:4000';
const NAV_URL = process.env.NEXT_PUBLIC_SE7EN_API_URL ?? 'http://localhost:4000';
const AUTH_TOKEN = process.env.NEXT_PUBLIC_SE7EN_JWT ?? process.env.SE7EN_JWT ?? '';
const HEALTH_SERVICES: Record<string, string> = {
  se7en: BASE_URL,
  orchestrator: BASE_URL,
  contracts: process.env.NEXT_PUBLIC_EKLESIA_API_URL ?? BASE_URL,
};

const jsonSchema = z.unknown();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }

  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = value as string;
      }
    } else {
      Object.assign(headers, init.headers as Record<string, string>);
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...init,
  });

  const contentType = res.headers.get('content-type');
  const payload = contentType && contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const errorMessage = typeof payload === 'string' ? payload : (payload as any)?.error ?? 'unknown_error';
    throw new Error(errorMessage);
  }

  return jsonSchema.parse(payload) as T;
}

export interface IntakePayload {
  assetLabel: string;
  docs: Array<{ type: string; hash: string }>;
  notes?: string;
}

export interface MintPayload {
  instrument: 'CSDN' | 'SDN';
  assetLabel: string;
  par: string;
  affidavitId?: string;
  notes?: string;
}

export interface InsurancePayload {
  assetLabel: string;
  classCode: number;
  factorBps: string;
  disclosureHash?: string;
  notes?: string;
}

export interface CyclePayload {
  noteId: string;
  days: number;
  rateBps: number;
  notes?: string;
}

export interface RedemptionPayload {
  noteId: string;
  amount: string;
  holder?: string;
  notes?: string;
}

export async function createIntake(payload: IntakePayload) {
  return request<{ attestationId: string; affidavitId: string; assetId: string }>(`/intake`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createMint(payload: MintPayload) {
  return request<{ noteId: string; attestationId: string }>(`/mint`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createInsurance(payload: InsurancePayload) {
  return request<{ binderId: string; attestationId: string }>(`/insurance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createCycle(payload: CyclePayload) {
  return request<{ cycleId: string; attestationId: string }>(`/circulate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createRedemption(payload: RedemptionPayload) {
  return request<{ attestationId: string; noteId: string; affidavitId: string }>(`/redeem`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface VerifyResponse {
  attestation: {
    id: string;
    subjectId: string;
    payloadHash: string;
    clause: string;
    timestamp: string;
    attestor: string;
    jurisdiction: string;
  };
  affidavit: unknown;
  audit: unknown;
  safeVault: {
    docHashes: string[];
  };
}

export async function fetchVerification(attestationId: string): Promise<VerifyResponse> {
  return request<VerifyResponse>(`/verify/${attestationId}`);
}

export async function downloadVerificationPdf(attestationId: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }
  const response = await fetch(`${BASE_URL}/verify/${attestationId}/pdf`, { headers });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(message || 'failed_to_download_pdf');
  }
  return await response.blob();
}

export interface NavSnapshot {
  navPerToken: number;
  floor: number;
  price: number;
  pools: {
    stable: number;
    insured: number;
    yield: number;
    liab: number;
    supply: number;
  };
  eyeionHash: string | null;
}

export async function fetchNav(): Promise<NavSnapshot> {
  const res = await fetch(`${NAV_URL}/api/nav`);
  const data = await res.json();
  return data as NavSnapshot;
}

export interface ServiceHealth {
  name: string;
  healthy: boolean;
}

export async function fetchServiceHealth(): Promise<ServiceHealth[]> {
  const entries = await Promise.all(
    Object.entries(HEALTH_SERVICES).map(async ([name, base]) => {
      try {
        const res = await fetch(`${base}/health`);
        if (!res.ok) return { name, healthy: false };
        const data = await res.json();
        return { name, healthy: Boolean(data?.ok) };
      } catch (error) {
        return { name, healthy: false };
      }
    })
  );
  return entries;
}
