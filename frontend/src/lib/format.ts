export const taka = (minor: number, compact = false) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  })
    .format(minor / 100)
    .replace("BDT", "৳");
export const dateLabel = (
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) =>
  new Date(value).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "Asia/Dhaka",
  });
export const daysUntil = (value: string) =>
  Math.max(0, Math.ceil((+new Date(value) - Date.now()) / 86400000));
export const statusLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const localDateToISO = (value: string) =>
  new Date(`${value}:00+06:00`).toISOString();
