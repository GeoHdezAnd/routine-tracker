export type MovementType = "COMPOUND" | "ISOLATION";
export type TrainingGoal = "STRENGTH" | "HYPERTROPHY" | "ENDURANCE";
export type UnitPreference = "KG" | "LB";

export interface SetLogInput {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir?: number;
  note?: string;
}
