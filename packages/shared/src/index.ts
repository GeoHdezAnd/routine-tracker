export type MovementType = "COMPOUND" | "ISOLATION";
export type TrainingGoal = "STRENGTH" | "HYPERTROPHY" | "ENDURANCE";
export type UnitPreference = "KG" | "LB";

export const ROUTINE_COLORS = [
  "blue",
  "orange",
  "teal",
  "green",
  "amber",
  "purple",
  "red",
  "pink",
] as const;
export type RoutineColor = (typeof ROUTINE_COLORS)[number];

export interface SetLogInput {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir?: number;
  note?: string;
}
