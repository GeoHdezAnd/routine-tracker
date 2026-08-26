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
  overrides: Partial<{ name: string; movementType: string }> = {},
) {
  const response = await request(app)
    .post("/exercises")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: overrides.name ?? "PROGRESS-test Squat",
      muscleGroup: "Legs",
      equipmentType: "Barbell",
      movementType: overrides.movementType ?? "COMPOUND",
    });
  return response.body.id as string;
}

async function createRoutine(app: ReturnType<typeof createApp>, token: string, name = "PROGRESS-test Routine") {
  const response = await request(app).post("/routines").set("Authorization", `Bearer ${token}`).send({ name });
  return response.body.id as string;
}

async function addExerciseToRoutine(
  app: ReturnType<typeof createApp>,
  token: string,
  routineId: string,
  exerciseId: string,
  targetRepMax: number,
) {
  await request(app)
    .post(`/routines/${routineId}/exercises`)
    .set("Authorization", `Bearer ${token}`)
    .send({ exerciseId, order: 1, goal: "HYPERTROPHY", targetSets: 3, targetRepMin: 6, targetRepMax });
}

async function startSession(app: ReturnType<typeof createApp>, token: string, routineId?: string) {
  const response = await request(app)
    .post("/sessions")
    .set("Authorization", `Bearer ${token}`)
    .send(routineId ? { routineId } : {});
  return response.body.id as string;
}

async function logSet(
  app: ReturnType<typeof createApp>,
  token: string,
  sessionId: string,
  exerciseId: string,
  weightKg: number,
  reps: number,
) {
  await request(app)
    .post(`/sessions/${sessionId}/logs`)
    .set("Authorization", `Bearer ${token}`)
    .send({ exerciseId, weightKg, reps });
}

async function finishSession(app: ReturnType<typeof createApp>, token: string, sessionId: string) {
  await request(app).post(`/sessions/${sessionId}/finish`).set("Authorization", `Bearer ${token}`);
}

/** Full flow: routine + exercise (targetRepMax) + a finished session with one top set. */
async function qualifyingSession(
  app: ReturnType<typeof createApp>,
  token: string,
  exerciseId: string,
  targetRepMax: number,
  weightKg: number,
  reps: number,
) {
  const routineId = await createRoutine(app, token);
  await addExerciseToRoutine(app, token, routineId, exerciseId, targetRepMax);
  const sessionId = await startSession(app, token, routineId);
  await logSet(app, token, sessionId, exerciseId, weightKg, reps);
  await finishSession(app, token, sessionId);
  return sessionId;
}

describe("GET /exercises/:id/progress", () => {
  const email = "progress-exercise@example.com";

  beforeEach(async () => {
    await prisma.setLog.deleteMany({ where: { session: { user: { email } } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns 404 for a non-existent or invisible exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app)
      .get("/exercises/does-not-exist/progress")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("computes estimated1RM correctly for a logged set", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    const sessionId = await startSession(app, token);
    await logSet(app, token, sessionId, exerciseId, 100, 5);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.sessions).toHaveLength(1);
    expect(response.body.sessions[0]).toMatchObject({ sessionId, isNewPR: true });
    expect(response.body.sessions[0].sets).toHaveLength(1);
    expect(response.body.sessions[0].sets[0]).toMatchObject({ weightKg: 100, reps: 5, isTopOfDay: true });
    expect(response.body.sessions[0].sets[0].estimated1RM).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it("returns empty sessions and null summary when nothing was logged", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.sessions).toEqual([]);
    expect(response.body.summary).toEqual({ sessionCount: 0, bestWeightKg: null, bestVolumeSet: null });
  });

  it("computes summary (sessionCount, bestWeightKg, bestVolumeSet) across sessions", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);

    const session1 = await startSession(app, token);
    await logSet(app, token, session1, exerciseId, 60, 10);
    await finishSession(app, token, session1);

    const session2 = await startSession(app, token);
    await logSet(app, token, session2, exerciseId, 80, 3);
    await finishSession(app, token, session2);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.summary).toEqual({
      sessionCount: 2,
      bestWeightKg: 80,
      bestVolumeSet: { weightKg: 60, reps: 10 },
    });
  });

  it("marks isNewPR only on sessions that beat the running best weight", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);

    const session1 = await startSession(app, token);
    await logSet(app, token, session1, exerciseId, 60, 8);
    await finishSession(app, token, session1);

    const session2 = await startSession(app, token);
    await logSet(app, token, session2, exerciseId, 55, 8);
    await finishSession(app, token, session2);

    const session3 = await startSession(app, token);
    await logSet(app, token, session3, exerciseId, 65, 8);
    await finishSession(app, token, session3);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.sessions.map((s: { isNewPR: boolean }) => s.isNewPR)).toEqual([true, false, true]);
  });

  it("marks isTopOfDay on a single set when multiple sets are logged in one session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    const sessionId = await startSession(app, token);
    await logSet(app, token, sessionId, exerciseId, 60, 10);
    await logSet(app, token, sessionId, exerciseId, 62.5, 9);
    await logSet(app, token, sessionId, exerciseId, 62.5, 8);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    const topSets = response.body.sessions[0].sets.filter((set: { isTopOfDay: boolean }) => set.isTopOfDay);
    expect(topSets).toHaveLength(1);
    expect(topSets[0]).toMatchObject({ weightKg: 62.5, reps: 9 });
  });

  it("readyToProgress is false with fewer than 2 qualifying sessions", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(false);
    expect(response.body.suggestedWeightIncrease).toBeNull();
  });

  it("readyToProgress is false when the weight differs between the two sessions", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);
    await qualifyingSession(app, token, exerciseId, 8, 62.5, 8);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(false);
  });

  it("readyToProgress is false when reps don't reach targetRepMax in one session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);
    await qualifyingSession(app, token, exerciseId, 8, 60, 6);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(false);
  });

  it("readyToProgress is true with suggestedWeightIncrease 2.5 for a COMPOUND exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token, { movementType: "COMPOUND" });
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);
    await qualifyingSession(app, token, exerciseId, 8, 60, 9);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(true);
    expect(response.body.suggestedWeightIncrease).toBe(2.5);
  });

  it("readyToProgress is true with suggestedWeightIncrease 1 for an ISOLATION exercise", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token, { movementType: "ISOLATION" });
    await qualifyingSession(app, token, exerciseId, 12, 20, 12);
    await qualifyingSession(app, token, exerciseId, 12, 20, 14);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(true);
    expect(response.body.suggestedWeightIncrease).toBe(1);
  });

  it("a free session (no routine) does not count toward readyToProgress", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);

    const freeSessionId = await startSession(app, token);
    await logSet(app, token, freeSessionId, exerciseId, 60, 8);
    await finishSession(app, token, freeSessionId);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(false);
  });

  it("an unfinished session does not count toward readyToProgress", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token);
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);

    const routineId = await createRoutine(app, token, "PROGRESS-test Routine 2");
    await addExerciseToRoutine(app, token, routineId, exerciseId, 8);
    const openSessionId = await startSession(app, token, routineId);
    await logSet(app, token, openSessionId, exerciseId, 60, 8);

    const response = await request(app)
      .get(`/exercises/${exerciseId}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.readyToProgress).toBe(false);
  });
});

describe("GET /dashboard", () => {
  const email = "progress-dashboard@example.com";

  beforeEach(async () => {
    await prisma.setLog.deleteMany({ where: { session: { user: { email } } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("returns recent sessions, routines, and exercises ready to progress", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);
    const exerciseId = await createExercise(app, token, { movementType: "COMPOUND" });
    await qualifyingSession(app, token, exerciseId, 8, 60, 8);
    await qualifyingSession(app, token, exerciseId, 8, 60, 9);

    const response = await request(app).get("/dashboard").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.recentSessions.length).toBeGreaterThanOrEqual(1);
    expect(response.body.recentSessions[0]).toHaveProperty("routineName");
    expect(response.body.routines.length).toBeGreaterThanOrEqual(1);
    expect(response.body.readyToProgress).toContainEqual({
      exerciseId,
      exerciseName: "PROGRESS-test Squat",
      suggestedWeightIncrease: 2.5,
    });
  });
});
