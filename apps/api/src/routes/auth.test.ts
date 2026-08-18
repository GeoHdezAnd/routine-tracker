import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../lib/prisma.js";

describe("POST /auth/register", () => {
  const email = "register-test@example.com";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it("creates a user and returns it without the password hash", async () => {
    const response = await request(createApp()).post("/auth/register").send({
      email,
      password: "supersecret123",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ email, unitPreference: "KG" });
    expect(response.body.passwordHash).toBeUndefined();
  });
});
