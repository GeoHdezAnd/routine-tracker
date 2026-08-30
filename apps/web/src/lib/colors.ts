import { ROUTINE_COLORS } from "@routine-tracker/shared";
import type { RoutineColor } from "@routine-tracker/shared";

type ColorSwatch = { dot: string; soft: string; fg: string };

const COLOR_PALETTE: Record<RoutineColor, ColorSwatch> = {
  blue: { dot: "bg-group-5", soft: "bg-group-5-soft", fg: "text-group-5" },
  orange: { dot: "bg-group-1", soft: "bg-group-1-soft", fg: "text-group-1" },
  teal: { dot: "bg-group-2", soft: "bg-group-2-soft", fg: "text-group-2" },
  green: { dot: "bg-group-7", soft: "bg-group-7-soft", fg: "text-group-7" },
  amber: { dot: "bg-group-6", soft: "bg-group-6-soft", fg: "text-group-6" },
  purple: { dot: "bg-group-3", soft: "bg-group-3-soft", fg: "text-group-3" },
  red: { dot: "bg-group-4", soft: "bg-group-4-soft", fg: "text-group-4" },
  pink: { dot: "bg-group-8", soft: "bg-group-8-soft", fg: "text-group-8" },
};

const PALETTE = ROUTINE_COLORS.map((key) => COLOR_PALETTE[key]);

export { ROUTINE_COLORS };
export type { RoutineColor };

export function colorForLabel(label: string): ColorSwatch {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function colorForKey(key: RoutineColor): ColorSwatch {
  return COLOR_PALETTE[key];
}

export function colorForRoutine(routine: { color?: string | null; name: string }): ColorSwatch {
  if (routine.color && (ROUTINE_COLORS as readonly string[]).includes(routine.color)) {
    return COLOR_PALETTE[routine.color as RoutineColor];
  }
  return colorForLabel(routine.name);
}
