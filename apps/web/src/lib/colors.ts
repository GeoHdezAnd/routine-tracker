const PALETTE = [
  { dot: "bg-group-1", soft: "bg-group-1-soft", fg: "text-group-1" },
  { dot: "bg-group-2", soft: "bg-group-2-soft", fg: "text-group-2" },
  { dot: "bg-group-3", soft: "bg-group-3-soft", fg: "text-group-3" },
  { dot: "bg-group-4", soft: "bg-group-4-soft", fg: "text-group-4" },
  { dot: "bg-group-5", soft: "bg-group-5-soft", fg: "text-group-5" },
  { dot: "bg-group-6", soft: "bg-group-6-soft", fg: "text-group-6" },
];

export function colorForLabel(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
