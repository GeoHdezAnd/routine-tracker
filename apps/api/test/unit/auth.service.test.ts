import { describe, expect, it } from "vitest";
import { calculateAge } from "../../src/services/auth.service.js";

describe("calculateAge", () => {
  it("returns the full year difference when the birthday already passed this year", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const birthDate = new Date("1998-05-20T00:00:00.000Z");

    expect(calculateAge(birthDate, now)).toBe(28);
  });

  it("does not count this year yet when the birthday has not happened", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const birthDate = new Date("1998-12-01T00:00:00.000Z");

    expect(calculateAge(birthDate, now)).toBe(27);
  });

  it("counts the birthday on the exact day it happens", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");
    const birthDate = new Date("1998-08-18T00:00:00.000Z");

    expect(calculateAge(birthDate, now)).toBe(28);
  });
});
