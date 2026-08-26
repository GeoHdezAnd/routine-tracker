import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma, type UnitPreference } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const SALT_ROUNDS = 10;

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set");
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("El email ya está registrado");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email o contraseña inválidos");
    this.name = "InvalidCredentialsError";
  }
}

type RegisterUserExtra = {
  name?: string;
  birthDate?: Date;
};

export async function registerUser(
  email: string,
  password: string,
  extra: RegisterUserExtra = {},
) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    return await prisma.user.create({
      data: { email, passwordHash, name: extra.name, birthDate: extra.birthDate },
      select: {
        id: true,
        email: true,
        name: true,
        birthDate: true,
        unitPreference: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EmailAlreadyRegisteredError();
    }
    throw error;
  }
}

export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const token = jwt.sign({}, jwtSecret!, { subject: user.id, expiresIn: "7d" });

  return { token };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      birthDate: true,
      unitPreference: true,
      createdAt: true,
    },
  });
}

export async function updateUserUnitPreference(id: string, unitPreference: UnitPreference) {
  return prisma.user.update({
    where: { id },
    data: { unitPreference },
    select: {
      id: true,
      email: true,
      name: true,
      birthDate: true,
      unitPreference: true,
      createdAt: true,
    },
  });
}
