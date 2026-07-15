export function mergeDatePart(base: Date, datePart: Date): Date {
  const merged = new Date(base);
  merged.setFullYear(datePart.getFullYear(), datePart.getMonth(), datePart.getDate());
  return merged;
}

export function mergeTimePart(base: Date, timePart: Date): Date {
  const merged = new Date(base);
  merged.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return merged;
}

export function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
