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
    await prisma.exercise.deleteMany({ where: { name: "Barbell Squat" } });
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
      .query({ limit: 100 })
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const names = response.body.data.map((exercise: { name: string }) => exercise.name);
    expect(names).toContain("GET-test Global Pushup");
    expect(names).toContain("GET-test Owner Curl");
    expect(names).not.toContain("GET-test Other Curl");
  });

  it("returns 401 without a token", async () => {
    const response = await request(createApp()).get("/exercises");

    expect(response.status).toBe(401);
  });
});

describe("GET /exercises filters and pagination", () => {
  const email = "exercises-filters@example.com";

  beforeEach(async () => {
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "FILTER-test" } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  async function seedFilterExercises(app: ReturnType<typeof createApp>, token: string) {
    const specs = [
      { name: "FILTER-test A", muscleGroup: "Chest", equipmentType: "Barbell", movementType: "COMPOUND" },
      { name: "FILTER-test B", muscleGroup: "Chest", equipmentType: "Dumbbell", movementType: "ISOLATION" },
      { name: "FILTER-test C", muscleGroup: "Back", equipmentType: "Barbell", movementType: "COMPOUND" },
      { name: "FILTER-test D", muscleGroup: "Back", equipmentType: "Machine", movementType: "ISOLATION" },
      { name: "FILTER-test E", muscleGroup: "Legs", equipmentType: "Barbell", movementType: "COMPOUND" },
    ];

    for (const spec of specs) {
      await request(app).post("/exercises").set("Authorization", `Bearer ${token}`).send(spec);
    }
  }

  it("filters by muscleGroup", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    await seedFilterExercises(app, token);

    const response = await request(app)
      .get("/exercises")
      .query({ muscleGroup: "Chest" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const names = response.body.data.map((e: { name: string }) => e.name);
    expect(names.sort()).toEqual(["FILTER-test A", "FILTER-test B"]);
  });

  it("filters by equipmentType", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    await seedFilterExercises(app, token);

    const response = await request(app)
      .get("/exercises")
      .query({ equipmentType: "Machine" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const names = response.body.data.map((e: { name: string }) => e.name);
    expect(names).toEqual(["FILTER-test D"]);
  });

  it("filters by movementType", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    await seedFilterExercises(app, token);

    // movementType alone also matches the global seeded catalog (~95 real
    // exercises), so we raise the limit to fit everything on one page and
    // narrow down to our own fixtures before asserting, instead of assuming
    // an empty/isolated dataset.
    const response = await request(app)
      .get("/exercises")
      .query({ movementType: "ISOLATION", limit: 100 })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const names = response.body.data
      .filter((e: { name: string }) => e.name.startsWith("FILTER-test"))
      .map((e: { name: string }) => e.name)
      .sort();
    expect(names).toEqual(["FILTER-test B", "FILTER-test D"]);
  });

  it("combines multiple filters", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    await seedFilterExercises(app, token);

    const response = await request(app)
      .get("/exercises")
      .query({ muscleGroup: "Back", movementType: "COMPOUND" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const names = response.body.data.map((e: { name: string }) => e.name);
    expect(names).toEqual(["FILTER-test C"]);
  });

  it("returns 400 for an invalid movementType", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .get("/exercises")
      .query({ movementType: "FOO" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("paginates with limit/offset and reports total unfiltered by pagination", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    await seedFilterExercises(app, token);

    const firstPage = await request(app)
      .get("/exercises")
      .query({ muscleGroup: "Chest", limit: 1, offset: 0 })
      .set("Authorization", `Bearer ${token}`);
    const secondPage = await request(app)
      .get("/exercises")
      .query({ muscleGroup: "Chest", limit: 1, offset: 1 })
      .set("Authorization", `Bearer ${token}`);

    expect(firstPage.body.data).toHaveLength(1);
    expect(secondPage.body.data).toHaveLength(1);
    expect(firstPage.body.data[0].name).not.toBe(secondPage.body.data[0].name);
    expect(firstPage.body.total).toBe(2);
    expect(secondPage.body.total).toBe(2);
  });

  it("clamps a limit above the maximum down to 100", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .get("/exercises")
      .query({ limit: 500 })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.limit).toBe(100);
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

  it("removes the exercise from any routine using it, without deleting the routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "DELETE-test In Routine",
        muscleGroup: "Legs",
        equipmentType: "Barbell",
        movementType: "COMPOUND",
      });
    const routine = await prisma.routine.create({
      data: { userId: me.body.id, name: "DELETE-test Routine" },
    });
    await prisma.routineExercise.create({
      data: {
        routineId: routine.id,
        exerciseId: createResponse.body.id,
        order: 1,
        goal: "STRENGTH",
        targetSets: 3,
        targetRepMin: 3,
        targetRepMax: 6,
      },
    });

    const response = await request(app)
      .delete(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const routineStillExists = await prisma.routine.findUnique({ where: { id: routine.id } });
    expect(routineStillExists).not.toBeNull();
    const remainingRoutineExercises = await prisma.routineExercise.findMany({
      where: { routineId: routine.id },
    });
    expect(remainingRoutineExercises).toHaveLength(0);
  });

  it("returns 409 when the exercise has a logged set", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    const createResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "DELETE-test Logged",
        muscleGroup: "Chest",
        equipmentType: "Barbell",
        movementType: "COMPOUND",
      });
    const session = await prisma.workoutSession.create({ data: { userId: me.body.id } });
    await prisma.setLog.create({
      data: {
        sessionId: session.id,
        exerciseId: createResponse.body.id,
        setNumber: 1,
        weightKg: 60,
        reps: 5,
      },
    });

    const response = await request(app)
      .delete(`/exercises/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });
});
