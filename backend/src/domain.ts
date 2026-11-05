export const activeStatuses = ["HELD", "AWAITING_ADVANCE", "CONFIRMED"];
export function money(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Money must be a non-negative integer in paisa");
  return value;
}
export function commission(amount: number, bps: number) {
  money(amount);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000)
    throw new Error("Invalid commission");
  const fee = Math.floor((amount * bps) / 10000);
  return { grossMinor: amount, commissionMinor: fee, netMinor: amount - fee };
}
export function overlaps(a: Date, b: Date, c: Date, d: Date) {
  return a < d && c < b;
}
export function budgetAlert(planned: number, committed: number, threshold = 1) {
  return committed > planned * threshold;
}
export function capacityWarning(parties: number[], capacity: number) {
  return parties.reduce((sum, size) => sum + size, 0) > capacity;
}
export function packagePrice(prices: number[], discountBps: number) {
  if (discountBps < 0 || discountBps > 10000)
    throw new Error("Invalid discount");
  return Math.round(
    (prices.reduce((a, b) => a + money(b), 0) * (10000 - discountBps)) / 10000,
  );
}
