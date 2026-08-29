import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

async function registerAndLogin(app: ReturnType<typeof createApp>, email: string) {
  const password = "supersecret123";
  await request(app).post("/auth/register").send({ email, password });
  const loginResponse = await request(app).post("/auth/login").send({ email, password });
  return loginResponse.body.token as string;
}

describe("GET /dashboard", () => {
  const email = "dashboard-get@example.com";

  beforeEach(async () => {
    await prisma.workoutSession.deleteMany({ where: { user: { email } } });
    await prisma.routine.deleteMany({ where: { user: { email } } });
    await prisma.exercise.deleteMany({ where: { name: { startsWith: "DASHBOARD-test" } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it("computes streak, weekly/total counts, today's routine, and per-session volume and duration", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const exerciseResponse = await request(app)
      .post("/exercises")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "DASHBOARD-test Squat", muscleGroup: "Legs", equipmentType: "Barbell", movementType: "COMPOUND" });
    const exerciseId = exerciseResponse.body.id as string;

    const todayCode = DAY_CODES[new Date().getUTCDay()];
    const routineResponse = await request(app)
      .post("/routines")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Push Day", trainingDays: [todayCode] });
    const routineId = routineResponse.body.id as string;
    await request(app)
      .post(`/routines/${routineId}/exercises`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, order: 1, goal: "HYPERTROPHY", targetSets: 3 });

    const sessionResponse = await request(app).post("/sessions").set("Authorization", `Bearer ${token}`).send({});
    const sessionId = sessionResponse.body.id as string;
    await request(app)
      .post(`/sessions/${sessionId}/logs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ exerciseId, weightKg: 100, reps: 10 });
    await request(app).post(`/sessions/${sessionId}/finish`).set("Authorization", `Bearer ${token}`);

    const response = await request(app).get("/dashboard").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.dayStreak).toBe(1);
    expect(response.body.sessionsThisWeek).toBe(1);
    expect(response.body.totalWorkouts).toBe(1);
    expect(response.body.today).toMatchObject({ routineId, routineName: "Push Day", exerciseCount: 1 });

    const recentSession = response.body.recentSessions.find((session: { id: string }) => session.id === sessionId);
    expect(recentSession.volumeKg).toBe(1000);
    expect(typeof recentSession.durationSeconds).toBe("number");
    expect(recentSession.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("returns today: null when no routine is scheduled for today", async () => {
    const app = createApp();
    const token = await registerAndLogin(app, email);

    const response = await request(app).get("/dashboard").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.today).toBeNull();
    expect(response.body.dayStreak).toBe(0);
    expect(response.body.totalWorkouts).toBe(0);
  });

  describe("tzOffsetMinutes", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("resolves today's routine using the caller's local day instead of UTC", async () => {
      // 2026-01-08T00:30:00Z is Thursday in UTC but still Wednesday at UTC-6 (tzOffsetMinutes: -360).
      // Only Date is faked so supertest's internal timers (setTimeout/setImmediate) still run normally.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-01-08T00:30:00.000Z"));

      const app = createApp();
      const token = await registerAndLogin(app, email);

      const routineResponse = await request(app)
        .post("/routines")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Push Day", trainingDays: ["WED"] });
      const routineId = routineResponse.body.id as string;

      const utcResponse = await request(app).get("/dashboard").set("Authorization", `Bearer ${token}`);
      expect(utcResponse.body.today).toBeNull();

      const localResponse = await request(app)
        .get("/dashboard?tzOffsetMinutes=-360")
        .set("Authorization", `Bearer ${token}`);
      expect(localResponse.body.today).toMatchObject({ routineId, routineName: "Push Day" });
    });
  });
});
