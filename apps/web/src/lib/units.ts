export type UnitPreference = "KG" | "LB";

const KG_TO_LB = 2.2046226218;

export function kgToDisplay(weightKg: number, unit: UnitPreference): number {
  const value = unit === "LB" ? weightKg * KG_TO_LB : weightKg;
  return Math.round(value * 10) / 10;
}

export function displayToKg(displayValue: number, unit: UnitPreference): number {
  const value = unit === "LB" ? displayValue / KG_TO_LB : displayValue;
  return Math.round(value * 10) / 10;
}

export function unitLabel(unit: UnitPreference): "kg" | "lb" {
  return unit === "LB" ? "lb" : "kg";
}