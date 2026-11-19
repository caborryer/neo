import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/** Crea la Coach única (§1.4). Es idempotente: si ya existe una Coach no hace nada. */
async function main() {
  const email = process.env.SEED_COACH_EMAIL;
  const password = process.env.SEED_COACH_PASSWORD;
  if (!email || !password) {
    throw new Error('Define SEED_COACH_EMAIL y SEED_COACH_PASSWORD en .env');
  }

  const existing = await prisma.user.findFirst({ where: { role: UserRole.COACH } });
  if (existing) {
    console.log(`Ya existe una Coach (${existing.email}); no se crea otra.`);
    return;
  }

  const coach = await prisma.user.create({
    data: {
      firstName: process.env.SEED_COACH_FIRST_NAME ?? 'Coach',
      lastName: process.env.SEED_COACH_LAST_NAME ?? 'Neo',
      email: email.trim().toLowerCase(),
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: UserRole.COACH,
      status: UserStatus.ACTIVE,
      activatedAt: new Date(),
    },
  });
  console.log(`Coach creada: ${coach.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
