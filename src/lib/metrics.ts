const counters = new Map<string, number>();

export function incrementMetric(name: string): void {
  counters.set(name, (counters.get(name) || 0) + 1);
}

export function getMetric(name: string): number {
  return counters.get(name) || 0;
}
