import { PrismaClient } from "@prisma/client";

/**
 * Responsibility:
 * - Provide a singleton PrismaClient for Next.js dev (HMR safe).
 *
 * Guard:
 * - Ensure `DATABASE_URL` exists at runtime to avoid Prisma initialization errors.
 *   In production, prefer explicit environment configuration.
 */
const DEFAULT_SQLITE_DATABASE_URL = "file:./prisma/dev.db";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_SQLITE_DATABASE_URL;
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

