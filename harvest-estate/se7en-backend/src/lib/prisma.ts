import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type PrismaTransaction = Parameters<typeof prisma.$transaction>[0];
