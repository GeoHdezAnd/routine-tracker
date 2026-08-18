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

  it("accepts optional name and birthDate and returns them", async () => {
    const response = await request(createApp()).post("/auth/register").send({
      email,
      password: "supersecret123",
      name: "Ada Lovelace",
      birthDate: "1998-05-20",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Ada Lovelace" });
    expect(response.body.birthDate).toBe("1998-05-20T00:00:00.000Z");
  });

  it("leaves name and birthDate as null when not provided", async () => {
    const response = await request(createApp()).post("/auth/register").send({
      email,
      password: "supersecret123",
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBeNull();
    expect(response.body.birthDate).toBeNull();
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

describe("GET /auth/me", () => {
  const email = "me-test@example.com";
  const password = "supersecret123";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns 401 when no Authorization header is sent", async () => {
    const response = await request(createApp()).get("/auth/me");

    expect(response.status).toBe(401);
  });

  it("returns 401 when the token is invalid", async () => {
    const response = await request(createApp())
      .get("/auth/me")
      .set("Authorization", "Bearer garbage-token");

    expect(response.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const app = createApp();
    await request(app).post("/auth/register").send({ email, password });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const token = loginResponse.body.token;

    const response = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email, unitPreference: "KG" });
    expect(response.body.passwordHash).toBeUndefined();
  });

  it("returns age null when birthDate was not provided", async () => {
    const app = createApp();
    await request(app).post("/auth/register").send({ email, password });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const token = loginResponse.body.token;

    const response = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.birthDate).toBeNull();
    expect(response.body.age).toBeNull();
  });

  it("returns name, birthDate and a computed age when birthDate was provided", async () => {
    const app = createApp();
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const birthDate = tenYearsAgo.toISOString().slice(0, 10);

    await request(app)
      .post("/auth/register")
      .send({ email, password, name: "Grace Hopper", birthDate });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const token = loginResponse.body.token;

    const response = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Grace Hopper");
    expect(response.body.age).toBe(10);
  });
});
