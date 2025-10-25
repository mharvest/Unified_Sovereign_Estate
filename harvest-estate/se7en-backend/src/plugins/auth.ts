import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyJwt, type JwtClaims } from '../lib/jwt.js';
import type { FiduciaryRole } from '@prisma/client';

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  role: FiduciaryRole;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (roles?: FiduciaryRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

function parseAuthorization(header?: string): string | null {
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  return token;
}

export default fp(async function authPlugin(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to enable authentication');
  }

  const options = {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  } as const;

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = parseAuthorization(request.headers.authorization);
    if (!token) {
      reply.code(401).send({ ok: false, error: 'missing_token' });
      throw new Error('missing_token');
    }

    try {
      const decoded = verifyJwt(token, secret, options) as JwtClaims;
      if (typeof decoded.role !== 'string') {
        reply.code(403).send({ ok: false, error: 'role_required' });
        throw new Error('role_required');
      }

      request.user = {
        sub: typeof decoded.sub === 'string' ? decoded.sub : 'unknown',
        email: typeof decoded.email === 'string' ? decoded.email : undefined,
        role: decoded.role as FiduciaryRole,
        exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
        iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
        ...decoded,
      };
    } catch (error) {
      app.log.debug({ err: error }, 'jwt verification failed');
      reply.code(401).send({ ok: false, error: 'invalid_token' });
      throw error;
    }
  });

  app.decorate('authorize', (roles?: FiduciaryRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(request, reply);
      if (!roles || roles.length === 0) {
        return;
      }

      const role = request.user?.role;
      if (!role || !roles.includes(role)) {
        reply.code(403).send({ ok: false, error: 'forbidden' });
        throw new Error('forbidden');
      }
    };
  });
});
