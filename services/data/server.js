import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/health', async () => ({ service: 'data', status: 'ok' }));

fastify.listen({ port: process.env.PORT ? Number(process.env.PORT) : 4020, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
