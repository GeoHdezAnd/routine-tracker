import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const SALT_ROUNDS = 10;

export async function registerUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.user.create({
    data: { email, passwordHash },
    select: {
      id: true,
      email: true,
      unitPreference: true,
      createdAt: true,
    },
  });
}
