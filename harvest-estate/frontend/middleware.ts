import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const se7enApiUrl = process.env.NEXT_PUBLIC_SE7EN_API_URL ?? 'http://localhost:4000';
const eklesiaApiUrl = process.env.NEXT_PUBLIC_EKLESIA_API_URL ?? 'http://localhost:5050';

function generateNonce(): string {
  const array = globalThis.crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  array.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const scriptSrc = [`'self'`, `'nonce-${nonce}'`];
  if (process.env.NODE_ENV !== 'production') {
    scriptSrc.push("'unsafe-eval'", "'wasm-unsafe-eval'");
  }

  const connectSrc = [`'self'`, se7enApiUrl, eklesiaApiUrl];
  if (process.env.NODE_ENV !== 'production') {
    connectSrc.push('ws://localhost:3000', 'wss://localhost:3000');
  }

  const csp = [
    `default-src 'self'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src ${connectSrc.join(' ')}`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', `${csp};`);
  response.headers.set('Permissions-Policy', 'clipboard-write=()');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');

  return response;
}

export const config = {
  matcher: '/:path*',
};
