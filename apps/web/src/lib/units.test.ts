import { describe, expect, it } from "vitest";
import { displayToKg, kgToDisplay, unitLabel } from "./units";

describe("kgToDisplay", () => {
  it("returns the same rounded value for KG", () => {
    expect(kgToDisplay(100, "KG")).toBe(100);
    expect(kgToDisplay(62.53, "KG")).toBe(62.5);
  });

  it("converts kg to lb rounded to 1 decimal", () => {
    expect(kgToDisplay(100, "LB")).toBe(220.5);
  });
});

describe("displayToKg", () => {
  it("returns the same rounded value for KG", () => {
    expect(displayToKg(100, "KG")).toBe(100);
  });

  it("converts lb to kg rounded to 1 decimal", () => {
    expect(displayToKg(135, "LB")).toBe(61.2);
  });
});

describe("unitLabel", () => {
  it("returns kg for KG and lb for LB", () => {
    expect(unitLabel("KG")).toBe("kg");
    expect(unitLabel("LB")).toBe("lb");
  });
});