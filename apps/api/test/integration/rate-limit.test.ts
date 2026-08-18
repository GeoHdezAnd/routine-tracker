import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

// The auth limiter is skipped when NODE_ENV === "test" (vitest sets this by
// default) so the rest of the suite isn't rate-limited by its own requests.
// These tests flip NODE_ENV around a single createApp() instance to exercise
// the real, production behavior in isolation.
describe("auth rate limiting", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("allows up to the configured limit, then returns 429", async () => {
    process.env.NODE_ENV = "development";
    const app = createApp();

    const responses = [];
    for (let i = 0; i < 11; i++) {
      responses.push(
        await request(app).post("/auth/login").send({ email: "rate-limit@example.com", password: "wrong" }),
      );
    }

    const statuses = responses.map((r) => r.status);
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses[10]).toBe(429);
  });

  it("does not rate-limit /auth under NODE_ENV=test", async () => {
    // NODE_ENV is already "test" here (vitest default) — no override.
    const app = createApp();

    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const response = await request(app)
        .post("/auth/login")
        .send({ email: "no-rate-limit@example.com", password: "wrong" });
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(401);
  });
});
