/** Returns a timestamp strictly newer than the previous project revision. */
export function nextTimestamp(previous: number): number {
  return Math.max(Date.now(), previous + 1)
}
