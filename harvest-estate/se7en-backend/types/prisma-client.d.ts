// Minimal fallback typings to satisfy TypeScript when @prisma/client has not been generated yet.
declare module '@prisma/client' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class PrismaClient {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]);
    $disconnect(): Promise<void>;
  }
}
