/**
 * Bangladesh public holidays and planning periods used by the date planner.
 * Fixed-date holidays are exact. Lunar dates (Eid, Ramadan, Ashura, etc.) and
 * lunisolar Hindu/Buddhist festivals are ESTIMATES that move with moon
 * sighting; the API says so wherever they are shown. Update this table each
 * year from the official government holiday notice.
 */
export type Holiday = {
  date: string;
  endDate?: string;
  name: string;
  nameBn: string;
  kind: "NATIONAL" | "RELIGIOUS" | "RAMADAN";
  estimated: boolean;
};

const fixed = [
  ["02-21", "Shaheed Day & International Mother Language Day", "শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস"],
  ["03-26", "Independence Day", "স্বাধীনতা দিবস"],
  ["04-14", "Pohela Boishakh (Bangla New Year)", "পহেলা বৈশাখ"],
  ["05-01", "May Day", "মে দিবস"],
  ["12-16", "Victory Day", "বিজয় দিবস"],
  ["12-25", "Christmas Day", "বড়দিন"],
] as const;

const lunar: Holiday[] = [
  // 2026
  { date: "2026-02-04", name: "Shab-e-Barat", nameBn: "শবে বরাত", kind: "RELIGIOUS", estimated: true },
  { date: "2026-02-18", endDate: "2026-03-19", name: "Ramadan", nameBn: "রমজান", kind: "RAMADAN", estimated: true },
  { date: "2026-03-20", endDate: "2026-03-22", name: "Eid ul-Fitr", nameBn: "ঈদুল ফিতর", kind: "RELIGIOUS", estimated: true },
  { date: "2026-05-01", name: "Buddha Purnima", nameBn: "বুদ্ধ পূর্ণিমা", kind: "RELIGIOUS", estimated: true },
  { date: "2026-05-27", endDate: "2026-05-29", name: "Eid ul-Adha", nameBn: "ঈদুল আজহা", kind: "RELIGIOUS", estimated: true },
  { date: "2026-06-26", name: "Ashura", nameBn: "আশুরা", kind: "RELIGIOUS", estimated: true },
  { date: "2026-08-26", name: "Eid-e-Miladunnabi", nameBn: "ঈদে মিলাদুন্নবী", kind: "RELIGIOUS", estimated: true },
  { date: "2026-09-04", name: "Janmashtami", nameBn: "জন্মাষ্টমী", kind: "RELIGIOUS", estimated: true },
  { date: "2026-10-20", name: "Durga Puja (Bijoya Dashami)", nameBn: "দুর্গাপূজা (বিজয়া দশমী)", kind: "RELIGIOUS", estimated: true },
  // 2027
  { date: "2027-01-24", name: "Shab-e-Barat", nameBn: "শবে বরাত", kind: "RELIGIOUS", estimated: true },
  { date: "2027-02-08", endDate: "2027-03-09", name: "Ramadan", nameBn: "রমজান", kind: "RAMADAN", estimated: true },
  { date: "2027-03-10", endDate: "2027-03-12", name: "Eid ul-Fitr", nameBn: "ঈদুল ফিতর", kind: "RELIGIOUS", estimated: true },
  { date: "2027-05-17", endDate: "2027-05-19", name: "Eid ul-Adha", nameBn: "ঈদুল আজহা", kind: "RELIGIOUS", estimated: true },
  { date: "2027-05-20", name: "Buddha Purnima", nameBn: "বুদ্ধ পূর্ণিমা", kind: "RELIGIOUS", estimated: true },
  { date: "2027-06-15", name: "Ashura", nameBn: "আশুরা", kind: "RELIGIOUS", estimated: true },
  { date: "2027-08-15", name: "Eid-e-Miladunnabi", nameBn: "ঈদে মিলাদুন্নবী", kind: "RELIGIOUS", estimated: true },
  { date: "2027-08-25", name: "Janmashtami", nameBn: "জন্মাষ্টমী", kind: "RELIGIOUS", estimated: true },
  { date: "2027-10-09", name: "Durga Puja (Bijoya Dashami)", nameBn: "দুর্গাপূজা (বিজয়া দশমী)", kind: "RELIGIOUS", estimated: true },
  // 2028
  { date: "2028-01-13", name: "Shab-e-Barat", nameBn: "শবে বরাত", kind: "RELIGIOUS", estimated: true },
  { date: "2028-01-28", endDate: "2028-02-26", name: "Ramadan", nameBn: "রমজান", kind: "RAMADAN", estimated: true },
  { date: "2028-02-27", endDate: "2028-02-29", name: "Eid ul-Fitr", nameBn: "ঈদুল ফিতর", kind: "RELIGIOUS", estimated: true },
  { date: "2028-05-05", endDate: "2028-05-07", name: "Eid ul-Adha", nameBn: "ঈদুল আজহা", kind: "RELIGIOUS", estimated: true },
  { date: "2028-05-09", name: "Buddha Purnima", nameBn: "বুদ্ধ পূর্ণিমা", kind: "RELIGIOUS", estimated: true },
  { date: "2028-06-04", name: "Ashura", nameBn: "আশুরা", kind: "RELIGIOUS", estimated: true },
  { date: "2028-08-03", name: "Eid-e-Miladunnabi", nameBn: "ঈদে মিলাদুন্নবী", kind: "RELIGIOUS", estimated: true },
  { date: "2028-08-13", name: "Janmashtami", nameBn: "জন্মাষ্টমী", kind: "RELIGIOUS", estimated: true },
  { date: "2028-09-28", name: "Durga Puja (Bijoya Dashami)", nameBn: "দুর্গাপূজা (বিজয়া দশমী)", kind: "RELIGIOUS", estimated: true },
];

/** Holidays touching [from, to] (YYYY-MM-DD). Multi-day entries are expanded per day except Ramadan. */
export function holidaysBetween(from: string, to: string): Holiday[] {
  const result: Holiday[] = [];
  const years = new Set<number>();
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.add(y);
  for (const year of years)
    for (const [md, name, nameBn] of fixed) {
      const date = `${year}-${md}`;
      if (date >= from && date <= to) result.push({ date, name, nameBn, kind: "NATIONAL", estimated: false });
    }
  for (const h of lunar) {
    const end = h.endDate || h.date;
    if (end < from || h.date > to) continue;
    if (h.kind === "RAMADAN") {
      result.push(h);
      continue;
    }
    for (let t = Date.parse(`${h.date}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (date >= from && date <= to) result.push({ ...h, date, endDate: undefined });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
