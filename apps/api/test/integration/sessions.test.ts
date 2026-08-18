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
      name: overrides.name ?? "SESSIONS-test Squat",
      muscleGroup: overrides.muscleGroup ?? "Legs",
      equipmentType: overrides.equipmentType ?? "Barbell",
      movementType: overrides.movementType ?? "COMPOUND",
    });
  return response.body.id as string;
}

async function createRoutine(app: ReturnType<typeof createApp>, token: string, name = "SESSIONS-test Routine") {
  const response = await request(app).post("/routines").set("Authorization", `Bearer ${token}`).send({ name });
  return response.body.id as string;
}

describe("POST /sessions", () => {
  const ownerEmail = "sessions-post-owner@example.com";
  const otherEmail = "sessions-post-other@example.com";

  beforeEach(async () => {
    await prisma.routine.deleteMany({ where: { user: { email: { in: [ownerEmail, otherEmail] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("starts a free session without a routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});

    expect(response.status).toBe(201);
    expect(response.body.routineId).toBeNull();
    expect(response.body.finishedAt).toBeNull();
  });

  it("starts a session from the user's own routine", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const routineId = await createRoutine(app, token);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({ routineId });

    expect(response.status).toBe(201);
    expect(response.body.routineId).toBe(routineId);
  });

  it("returns 404 for a non-existent routineId", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({ routineId: "does-not-exist" });

    expect(response.status).toBe(404);
  });

  it("returns 404 for another user's routineId", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const otherRoutineId = await createRoutine(app, otherToken);

    const response = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ routineId: otherRoutineId });

    expect(response.status).toBe(404);
  });
});

describe("GET /sessions and GET /sessions/:id", () => {
  const ownerEmail = "sessions-get-owner@example.com";
  const otherEmail = "sessions-get-other@example.com";

  beforeEach(async () => {
    // SetLog.exercise is Restrict: clear logs BEFORE deleting the user, or
    // the user's own Exercise->User cascade collides with the still-alive
    // SetLog referencing it (same class of multi-path FK issue documented
    // in routine-tracker/user-delete-cascade, now confirmed for SetLog too).
    await prisma.setLog.deleteMany({ where: { session: { user: { email: { in: [ownerEmail, otherEmail] } } } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("lists only the user's own sessions, most recent first", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);

    const first = await request(app).post("/sessions").set("Authorization", `Bearer ${ownerToken}`).send({});
    const second = await request(app).post("/sessions").set("Authorization", `Bearer ${ownerToken}`).send({});
    await request(app).post("/sessions").set("Authorization", `Bearer ${otherToken}`).send({});

    const response = await request(app).get("/sessions").set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.map((session: { id: string }) => session.id);
    expect(ids).toEqual([second.body.id, first.body.id]);
  });

  it("returns a session with its set logs included", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });

    const response = await request(app).get(`/sessions/${sessionId}`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.setLogs).toHaveLength(1);
    expect(response.body.setLogs[0]).toMatchObject({ weightKg: 60, reps: 5, setNumber: 1 });
  });

  it("returns 404 for another user's session", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const sessionResponse = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    const response = await request(app)
      .get(`/sessions/${sessionResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.status).toBe(404);
  });

  it("returns 404 for a non-existent session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);

    const response = await request(app).get("/sessions/does-not-exist").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});

describe("POST /sessions/:id/finish", () => {
  const ownerEmail = "sessions-finish-owner@example.com";

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
  });

  it("finishes an open session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});

    const response = await request(app)
      .post(`/sessions/${sessionResponse.body.id}/finish`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.finishedAt).not.toBeNull();
  });

  it("returns 409 when finishing an already finished session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    await request(app).post(`/sessions/${sessionResponse.body.id}/finish`).set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .post(`/sessions/${sessionResponse.body.id}/finish`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });
});

describe("DELETE /sessions/:id", () => {
  const ownerEmail = "sessions-delete-owner@example.com";

  beforeEach(async () => {
    await prisma.setLog.deleteMany({ where: { session: { user: { email: ownerEmail } } } });
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
  });

  it("deletes the session and cascades its set logs", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });

    const response = await request(app).delete(`/sessions/${sessionId}`).set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(204);

    const remainingLogs = await prisma.setLog.findMany({ where: { sessionId } });
    expect(remainingLogs).toHaveLength(0);
  });
});

describe("POST /sessions/:id/logs", () => {
  const ownerEmail = "sessions-logs-owner@example.com";

  beforeEach(async () => {
    await prisma.setLog.deleteMany({ where: { session: { user: { email: ownerEmail } } } });
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
  });

  it("auto-increments setNumber per exercise within the session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;

    const first = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });
    const second = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 62.5, reps: 5, rir: 2, note: "felt strong" });

    expect(first.status).toBe(201);
    expect(first.body.setNumber).toBe(1);
    expect(second.status).toBe(201);
    expect(second.body.setNumber).toBe(2);
    expect(second.body).toMatchObject({ rir: 2, note: "felt strong" });
  });

  it("returns 404 when the exercise does not exist or is not visible", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});

    const response = await request(app)
      .post(`/sessions/${sessionResponse.body.id}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId: "does-not-exist", weightKg: 60, reps: 5 });

    expect(response.status).toBe(404);
  });

  it("returns 409 when logging into an already finished session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    await request(app).post(`/sessions/${sessionId}/finish`).set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });

    expect(response.status).toBe(409);
  });
});

describe("PATCH and DELETE /sessions/:id/logs/:logId", () => {
  const ownerEmail = "sessions-editlog-owner@example.com";
  const otherEmail = "sessions-editlog-other@example.com";

  beforeEach(async () => {
    await prisma.setLog.deleteMany({ where: { session: { user: { email: { in: [ownerEmail, otherEmail] } } } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
  });

  it("edits a set log while the session is open", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    const logResponse = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });

    const response = await request(app)
      .patch(`/sessions/${sessionId}/logs/${logResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 65, reps: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ weightKg: 65, reps: 4, setNumber: 1 });
  });

  it("removes a set log while the session is open", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    const logResponse = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });

    const response = await request(app)
      .delete(`/sessions/${sessionId}/logs/${logResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(204);
    const remaining = await prisma.setLog.findMany({ where: { sessionId } });
    expect(remaining).toHaveLength(0);
  });

  it("returns 409 when editing a log in an already finished session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    const logResponse = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });
    await request(app).post(`/sessions/${sessionId}/finish`).set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .patch(`/sessions/${sessionId}/logs/${logResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ weightKg: 65 });

    expect(response.status).toBe(409);
  });

  it("returns 409 when deleting a log in an already finished session", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, ownerEmail);
    const exerciseId = await createExercise(app, token);
    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id;
    const logResponse = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });
    await request(app).post(`/sessions/${sessionId}/finish`).set("Authorization", `Bearer ${token}`);

    const response = await request(app)
      .delete(`/sessions/${sessionId}/logs/${logResponse.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(409);
  });

  it("returns 404 when editing another user's log", async () => {
    const app = createApp();
    const ownerToken = await registerAndLogin(app, ownerEmail);
    const otherToken = await registerAndLogin(app, otherEmail);
    const exerciseId = await createExercise(app, ownerToken);
    const sessionResponse = await request(app)
      .post("/sessions")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});
    const sessionId = sessionResponse.body.id;
    const logResponse = await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ exerciseId, weightKg: 60, reps: 5 });

    const response = await request(app)
      .patch(`/sessions/${sessionId}/logs/${logResponse.body.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ weightKg: 999 });

    expect(response.status).toBe(404);
  });
});
