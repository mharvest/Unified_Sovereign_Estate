import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/health', async () => ({ service: 'vaultquant', status: 'ok' }));

fastify.listen({ port: process.env.PORT ? Number(process.env.PORT) : 4012, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
