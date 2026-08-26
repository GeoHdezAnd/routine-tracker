export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diffDays = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays > 1 && diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}
