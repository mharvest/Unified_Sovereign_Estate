#!/usr/bin/env tsx
import { config } from 'dotenv';
import path from 'node:path';
import { signJwt } from '../src/lib/jwt.js';

type Role = string;

const envFile = process.env.ENV_FILE;
if (envFile) {
  const resolved = path.isAbsolute(envFile) ? envFile : path.resolve(process.cwd(), envFile);
  config({ path: resolved, override: true });
} else {
  config();
}

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET must be set to generate tokens');
  process.exit(1);
}

const [, , roleArg = 'TREASURY', subjectArg = 'console-user'] = process.argv;
const ttl = Number.parseInt(process.env.JWT_TTL ?? '', 10);
const expiresInSeconds = Number.isFinite(ttl) ? ttl : 3600;
const issuer = process.env.JWT_ISSUER;
const audience = process.env.JWT_AUDIENCE;
const email = process.env.JWT_EMAIL ?? `${subjectArg}@harvest.estate`;

const token = signJwt(
  {
    sub: subjectArg,
    email,
    role: roleArg as Role,
  },
  secret,
  {
    expiresInSeconds,
    issuer,
    audience,
  },
);

process.stdout.write(`${token}\n`);
