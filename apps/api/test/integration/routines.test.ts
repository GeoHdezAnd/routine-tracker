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

async function createExercise(
  app: ReturnType<typeof createApp>,
  token: string,
  overrides: Partial<{ name: string; muscleGroup: string; equipmentType: string; movementType: string }> = {},
) {
  const response = await request(app)
    .post("/exercises")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: overrides.name ?? "ROUTINES-test Squat",
      muscleGroup: overrides.muscleGroup ?? "Legs",
      equipmentType: overrides.equipmentType ?? "Barbell",
      movementType: overrides.movementType ?? "COMPOUND",
    });
  return response.body.id as string;
}

describe("POST /routines", () => {
  const email = "routines-post@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("creates an empty routine owned by the current user", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Push Day" });
  });

  it("returns 401 without a token", async () => {
    const response = await request(createApp()).post("/routines").send({ name: "Push Day" });
    expect(response.status).toBe(401);
  });

  it("returns 400 when the body is invalid", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "" });

    expect(response.status).toBe(400);
  });

  it("creates a routine with muscleGroups", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day", muscleGroups: ["Chest", "Shoulders"] });

    expect(response.status).toBe(201);
    expect(response.body.muscleGroups).toEqual(["Chest", "Shoulders"]);
  });

  it("defaults muscleGroups to an empty array when omitted", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    expect(response.body.muscleGroups).toEqual([]);
  });
});

describe("GET /routines", () => {
  const ownerEmail = "routines-get-owner@example.com";
  const otherEmail = "routines-get-other@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("lists only the user's own routines", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);

    await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner Routine" });
    await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Other Routine" });

    const response = await request(app).get("/routines").set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const names = response.body.map((routine: { name: string }) => routine.name);
    expect(names).toContain("Owner Routine");
    expect(names).not.toContain("Other Routine");
  });

  it("excludes archived routines by default and includes them when archived=true", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "To Archive" });
    await request(app)
      .patch(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ archived: true });

    const activeResponse = await request(app).get("/routines").set("Authorization", `Bearer ${token}`);
    const archivedResponse = await request(app)
      .get("/routines?archived=true")
      .set("Authorization", `Bearer ${token}`);

    expect(activeResponse.body.map((routine: { name: string }) => routine.name)).not.toContain("To Archive");
    expect(archivedResponse.body.map((routine: { name: string }) => routine.name)).toContain("To Archive");
  });
});

describe("GET /routines/:id", () => {
  const ownerEmail = "routines-getone-owner@example.com";
  const otherEmail = "routines-getone-other@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "ROUTINES-test" } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("returns the routine with its exercises, ordered by order then supersetSlot", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);

    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });
    const routineId = createRoutineResponse.body.id;

    await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 2, supersetSlot: 2, goal: "HYPERTROPHY", targetSets: 3 });
    await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 2, supersetSlot: 1, goal: "HYPERTROPHY", targetSets: 3 });
    await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "STRENGTH", targetSets: 5 });

    const response = await request(app).get(`/routines/${routineId}`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.exercises).toHaveLength(3);
    expect(
      response.body.exercises.map((re: { order: number; supersetSlot: number | null }) => [
        re.order,
        re.supersetSlot,
      ]),
    ).toEqual([
      [1, null],
      [2, 1],
      [2, 2],
    ]);
  });

  it("returns 404 for another user's routine", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);

    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner Only" });

    const response = await request(app)
      .get(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a non-existent routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app).get("/routines/does-not-exist").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});

describe("PATCH /routines/:id", () => {
  const ownerEmail = "routines-patch-owner@example.com";
  const otherEmail = "routines-patch-other@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("renames the owner's routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Original" });

    const response = await request(app)
      .patch(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "Renamed" });
  });

  it("updates muscleGroups", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    const response = await request(app)
      .patch(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ muscleGroups: ["Chest", "Triceps"] });

    expect(response.status).toBe(200);
    expect(response.body.muscleGroups).toEqual(["Chest", "Triceps"]);
  });

  it("returns 404 when editing another user's routine", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner Only" });

    const response = await request(app)
      .patch(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ name: "Hijacked" });

    expect(response.status).toBe(404);
  });

  it("archives and unarchives a routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });
    const routineId = createResponse.body.id;

    const archiveResponse = await request(app)
      .patch(`/routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ archived: true });
    expect(archiveResponse.body.archived).toBe(true);

    const unarchiveResponse = await request(app)
      .patch(`/routines/${routineId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ archived: false });
    expect(unarchiveResponse.body.archived).toBe(false);
  });
});

describe("DELETE /routines/:id", () => {
  const ownerEmail = "routines-delete-owner@example.com";
  const otherEmail = "routines-delete-other@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("deletes the owner's routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "To Delete" });

    const response = await request(app)
      .delete(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const getResponse = await request(app)
      .get(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.status).toBe(404);
  });

  it("returns 404 when deleting another user's routine", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const createResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner Only" });

    const response = await request(app)
      .delete(`/routines/${createResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(404);
  });
});

describe("POST /routines/:id/exercises", () => {
  const ownerEmail = "routines-addex-owner@example.com";
  const otherEmail = "routines-addex-other@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "ROUTINES-test" } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("adds an exercise with an explicit rep range", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    const response = await request(app)
      .post(`/routines/${createRoutineResponse.body.id}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "STRENGTH", targetSets: 5, targetRepMin: 1, targetRepMax: 3 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ targetRepMin: 1, targetRepMax: 3, order: 1, supersetSlot: null });
  });

  it("applies the default rep range table for a compound exercise when reps are omitted", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token, { movementType: "COMPOUND" });
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    const response = await request(app)
      .post(`/routines/${createRoutineResponse.body.id}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "STRENGTH", targetSets: 5 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ targetRepMin: 3, targetRepMax: 6 });
  });

  it("applies the default rep range table for an isolation exercise when reps are omitted", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token, { movementType: "ISOLATION" });
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Arm Day" });

    const response = await request(app)
      .post(`/routines/${createRoutineResponse.body.id}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "HYPERTROPHY", targetSets: 3 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ targetRepMin: 10, targetRepMax: 15 });
  });

  it("supports a superset via matching order and distinct supersetSlot", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });
    const routineId = createRoutineResponse.body.id;

    const a1 = await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, supersetSlot: 1, goal: "HYPERTROPHY", targetSets: 3 });
    const a2 = await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, supersetSlot: 2, goal: "HYPERTROPHY", targetSets: 3 });

    expect(a1.status).toBe(201);
    expect(a2.status).toBe(201);
    expect(a1.body.order).toBe(a2.body.order);
    expect(a1.body.supersetSlot).not.toBe(a2.body.supersetSlot);
  });

  it("returns 404 when the exercise does not exist or is not visible", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    const response = await request(app)
      .post(`/routines/${createRoutineResponse.body.id}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId: "does-not-exist", order: 1, goal: "STRENGTH", targetSets: 5 });

    expect(response.status).toBe(404);
  });

  it("returns 404 when adding an exercise to another user's routine", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const exerciseId = await createExercise(app, otherToken);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Owner Only" });

    const response = await request(app)
      .post(`/routines/${createRoutineResponse.body.id}/exercises`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ exerciseId, order: 1, goal: "STRENGTH", targetSets: 5 });

    expect(response.status).toBe(404);
  });
});

describe("PATCH and DELETE /routines/:id/exercises/:routineExerciseId", () => {
  const ownerEmail = "routines-editex-owner@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: ownerEmail } } });
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "ROUTINES-test" } } });
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
  });

  it("edits a routine exercise without recalculating the rep range", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });
    const routineId = createRoutineResponse.body.id;
    const addResponse = await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "STRENGTH", targetSets: 5, targetRepMin: 1, targetRepMax: 3 });

    const response = await request(app)
      .patch(`/routines/${routineId}/exercises/${addResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ targetSets: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ targetSets: 4, targetRepMin: 1, targetRepMax: 3 });
  });

  it("removes an exercise from the routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });
    const routineId = createRoutineResponse.body.id;
    const addResponse = await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "STRENGTH", targetSets: 5 });

    const response = await request(app)
      .delete(`/routines/${routineId}/exercises/${addResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);

    const getResponse = await request(app).get(`/routines/${routineId}`).set("Authorization", `Bearer ${token}`);
    expect(getResponse.body.exercises).toHaveLength(0);
  });

  it("returns 404 when editing a routine exercise that does not exist", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const createRoutineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day" });

    const response = await request(app)
      .patch(`/routines/${createRoutineResponse.body.id}/exercises/does-not-exist`)
      .set("Authorization", `Bearer ${token}`)
      .send({ targetSets: 4 });

    expect(response.status).toBe(404);
  });
});

describe("GET /routines/rep-range-suggestion", () => {
  const email = "routines-suggestion@example.com";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns the default rep range for a movementType + goal combination", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .get("/routines/rep-range-suggestion?movementType=COMPOUND&goal=STRENGTH")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ targetRepMin: 3, targetRepMax: 6 });
  });

  it("returns 400 for an invalid movementType", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .get("/routines/rep-range-suggestion?movementType=INVALID&goal=STRENGTH")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });
});
