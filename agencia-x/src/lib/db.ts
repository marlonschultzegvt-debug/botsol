import { PrismaClient } from "@prisma/client";

/** Prisma singleton (evita abrir conexões novas a cada hot-reload em dev). */
const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = db;
