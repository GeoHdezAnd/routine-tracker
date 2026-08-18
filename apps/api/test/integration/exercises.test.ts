import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

async function registerAndLogin(app: ReturnType<typeof createApp>, email: string) {
  const password = "supersecret123";
  await request(app).post("/auth/register").send({ email, password });
  const loginResponse = await request(app).post("/auth/login").send({ email, password });
  return loginResponse.body.token as string;
}

describe("POST /exercises", () => {
  const email = "exercises-post@example.com";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it("creates a custom exercise owned by the current user", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Barbell Squat",
        muscleGroup: "Legs",
        equipmentType: "Barbell",
        movementType: "COMPOUND",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Barbell Squat",
      muscleGroup: "Legs",
      equipmentType: "Barbell",
      movementType: "COMPOUND",
    });
  });

  it("returns 401 without a token", async () => {
    const response = await request(createApp()).post("/exercises").send({
      name: "Barbell Squat",
      muscleGroup: "Legs",
      equipmentType: "Barbell",
      movementType: "COMPOUND",
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 when the body is invalid", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Barbell Squat" });

    expect(response.status).toBe(400);
  });
});

describe("GET /exercises", () => {
  const ownerEmail = "exercises-get-owner@example.com";
  const otherEmail = "exercises-get-other@example.com";

  beforeEach(async () => {
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "GET-test" } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("lists global exercises plus the user's own, but not other users' custom ones", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);

    await prisma.exercise.create({
      data: {
        name: "GET-test Global Pushup",
        muscleGroup: "Chest",
        equipmentType: "Bodyweight",
        movementType: "COMPOUND",
        ownerId: null,
      },
    });

    await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "GET-test Owner Curl",
        muscleGroup: "Arms",
        equipmentType: "Dumbbell",
        movementType: "ISOLATION",
      });

    await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        name: "GET-test Other Curl",
        muscleGroup: "Arms",
        equipmentType: "Dumbbell",
        movementType: "ISOLATION",
      });

    const response = await request(app)
      .get("/exercises")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const names = response.body.map((exercise: { name: string }) => exercise.name);
    expect(names).toContain("GET-test Global Pushup");
    expect(names).toContain("GET-test Owner Curl");
    expect(names).not.toContain("GET-test Other Curl");
  });

  it("returns 401 without a token", async () => {
    const response = await request(createApp()).get("/exercises");

    expect(response.status).toBe(401);
  });
});

describe("GET /exercises/:id", () => {
  const ownerEmail = "exercises-getone-owner@example.com";
  const otherEmail = "exercises-getone-other@example.com";

  beforeEach(async () => {
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "GETONE-test" } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("returns a global exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const globalExercise = await prisma.exercise.create({
      data: {
        name: "GETONE-test Global",
        muscleGroup: "Back",
        equipmentType: "Barbell",
        movementType: "COMPOUND",
        ownerId: null,
      },
    });

    const response = await request(app)
      .get(`/exercises/${globalExercise.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "GETONE-test Global" });
  });

  it("returns 404 for another user's custom exercise", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);

    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "GETONE-test Owner Only",
        muscleGroup: "Legs",
        equipmentType: "Machine",
        movementType: "ISOLATION",
      });

    const response = await request(app)
      .get(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a non-existent exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app)
      .get("/exercises/does-not-exist")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});

describe("PATCH /exercises/:id", () => {
  const ownerEmail = "exercises-patch-owner@example.com";
  const otherEmail = "exercises-patch-other@example.com";

  beforeEach(async () => {
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "PATCH-test" } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("updates the owner's own custom exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "PATCH-test Original",
        muscleGroup: "Arms",
        equipmentType: "Dumbbell",
        movementType: "ISOLATION",
      });

    const response = await request(app)
      .patch(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "PATCH-test Updated" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "PATCH-test Updated" });
  });

  it("returns 404 when editing another user's exercise (hides its existence)", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "PATCH-test Owner Only",
        muscleGroup: "Arms",
        equipmentType: "Dumbbell",
        movementType: "ISOLATION",
      });

    const response = await request(app)
      .patch(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });

  it("returns 403 when editing a global exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const globalExercise = await prisma.exercise.create({
      data: {
        name: "PATCH-test Global",
        muscleGroup: "Back",
        equipmentType: "Barbell",
        movementType: "COMPOUND",
        ownerId: null,
      },
    });

    const response = await request(app)
      .patch(`/exercises/${globalExercise.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(403);
  });

  it("returns 404 for a non-existent exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app)
      .patch("/exercises/does-not-exist")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /exercises/:id", () => {
  const ownerEmail = "exercises-delete-owner@example.com";
  const otherEmail = "exercises-delete-other@example.com";

  beforeEach(async () => {
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "DELETE-test" } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("deletes the owner's own custom exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "DELETE-test Mine",
        muscleGroup: "Arms",
        equipmentType: "Dumbbell",
        movementType: "ISOLATION",
      });

    const response = await request(app)
      .delete(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const getResponse = await request(app)
      .get(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.status).toBe(404);
  });

  it("returns 404 when deleting another user's exercise", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "DELETE-test Owner Only",
        muscleGroup: "Arms",
        equipmentType: "Dumbbell",
        movementType: "ISOLATION",
      });

    const response = await request(app)
      .delete(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 403 when deleting a global exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const globalExercise = await prisma.exercise.create({
      data: {
        name: "DELETE-test Global",
        muscleGroup: "Back",
        equipmentType: "Barbell",
        movementType: "COMPOUND",
        ownerId: null,
      },
    });

    const response = await request(app)
      .delete(`/exercises/${globalExercise.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("returns 404 for a non-existent exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app)
      .delete("/exercises/does-not-exist")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
