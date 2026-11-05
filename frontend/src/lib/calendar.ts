import { Day } from "./types";
export function downloadCalendar(title: string, days: Day[]) {
  const escape = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,");
  const date = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Utsab//Celebration Calendar//EN",
    "CALSCALE:GREGORIAN",
    ...days.flatMap((day) => [
      "BEGIN:VEVENT",
      `UID:${day.id}@utsab`,
      `DTSTAMP:${date(new Date().toISOString())}`,
      `DTSTART:${date(day.startsAt)}`,
      `DTEND:${date(day.endsAt)}`,
      `SUMMARY:${escape(`${title} · ${day.name}`)}`,
      `LOCATION:${escape(day.venueName || "")}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\r\n") + "\r\n"], {
      type: "text/calendar;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "utsab-celebrations.ics";
  a.click();
  URL.revokeObjectURL(url);
}
