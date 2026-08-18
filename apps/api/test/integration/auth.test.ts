import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

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

  it("returns 400 when the email is invalid", async () => {
    const response = await request(createApp()).post("/auth/register").send({
      email: "not-an-email",
      password: "supersecret123",
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the email is already registered", async () => {
    const app = createApp();
    await request(app).post("/auth/register").send({ email, password: "supersecret123" });

    const response = await request(app).post("/auth/register").send({
      email,
      password: "anotherpassword1",
    });

    expect(response.status).toBe(409);
  });
});

describe("POST /auth/login", () => {
  const email = "login-test@example.com";
  const password = "supersecret123";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await request(createApp()).post("/auth/register").send({ email, password });
  });

  it("returns a token for valid credentials", async () => {
    const response = await request(createApp()).post("/auth/login").send({ email, password });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
  });

  it("returns 401 when the password is wrong", async () => {
    const response = await request(createApp())
      .post("/auth/login")
      .send({ email, password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("returns 401 when the email is not registered", async () => {
    const response = await request(createApp())
      .post("/auth/login")
      .send({ email: "nobody@example.com", password });

    expect(response.status).toBe(401);
  });
});
