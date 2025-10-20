import type { NextApiRequest, NextApiResponse } from 'next';

const BACKEND_URL = (process.env.EKLESIA_API_URL || process.env.NEXT_PUBLIC_EKLESIA_API_URL || 'http://localhost:4000').replace(/\/$/, '');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/treasury/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'backend_unreachable' });
  }
}
