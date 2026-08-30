export const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type DayOfWeek = (typeof DAY_ORDER)[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: "Lun",
  TUE: "Mar",
  WED: "Mié",
  THU: "Jue",
  FRI: "Vie",
  SAT: "Sáb",
  SUN: "Dom",
};

export function sortDays(days: string[]): string[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a as DayOfWeek) - DAY_ORDER.indexOf(b as DayOfWeek));
}

const JS_DAY_TO_CODE: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function todayCode(date: Date = new Date()): DayOfWeek {
  return JS_DAY_TO_CODE[date.getDay()];
}

export function distanceFromToday(day: string, today: DayOfWeek): number {
  return (DAY_ORDER.indexOf(day as DayOfWeek) - DAY_ORDER.indexOf(today) + 7) % 7;
}
