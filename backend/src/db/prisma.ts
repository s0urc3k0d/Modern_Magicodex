import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance for the entire backend
export const prisma = new PrismaClient();

export default prisma;
