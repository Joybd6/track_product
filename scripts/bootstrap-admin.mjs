import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.INIT_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INIT_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("INIT_ADMIN_EMAIL and INIT_ADMIN_PASSWORD must be set.");
  }

  if (password.length < 8) {
    throw new Error("INIT_ADMIN_PASSWORD must be at least 8 characters long.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        passwordHash,
        forcePasswordChange: true,
      },
    });
    console.log(`Updated existing user as admin: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      forcePasswordChange: true,
    },
  });

  console.log(`Created initial admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to bootstrap admin");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
