import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyJwt, type JwtClaims } from '../lib/jwt.js';

export type FiduciaryRole = 'LAW' | 'OPS' | 'TREASURY' | 'INSURANCE' | 'GOVERNANCE' | 'ORACLE' | 'AUDITOR';

declare module 'fastify' {
  interface FastifyInstance {
    authorize: (roles?: FiduciaryRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: JwtClaims | null;
  }
}

export default fp(async (app: FastifyInstance) => {
  app.decorate('authorize', (roles?: FiduciaryRole[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        request.log.error('JWT_SECRET is not configured – refusing to authorize request');
        reply.code(500).send({ ok: false, error: 'auth_disabled' });
        return;
      }

      const header = request.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        reply.code(401).send({ ok: false, error: 'missing_token' });
        return;
      }

      const token = header.slice('Bearer '.length);
      try {
        const audienceEnv = process.env.JWT_AUDIENCE;
        const audience =
          audienceEnv && audienceEnv.includes(',')
            ? audienceEnv.split(',').map((item) => item.trim()).filter(Boolean)
            : audienceEnv ?? undefined;

        const decoded = verifyJwt(token, secret, {
          issuer: process.env.JWT_ISSUER,
          audience,
        });

        if (roles && roles.length > 0 && (!decoded.role || !roles.includes(decoded.role as FiduciaryRole))) {
          reply.code(403).send({ ok: false, error: 'forbidden', requiredRoles: roles });
          return;
        }
        request.user = decoded;
      } catch (error) {
        request.log.warn({ err: error }, 'jwt verification failed');
        reply.code(401).send({ ok: false, error: 'invalid_token' });
        return;
      }
    };
  });
});
