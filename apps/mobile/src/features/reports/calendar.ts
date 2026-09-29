// Month grids for the date picker and the P&L calendar: Monday-first weeks (like the service's weekday groups),
// days as YYYY-MM-DD strings (calendar dates, no time zone).

export type Ym = { y: number; m: number }; // m: 1..12

export const ymOf = (day: string): Ym => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) });
export const ymKey = ({ y, m }: Ym) => `${y}-${String(m).padStart(2, "0")}`;
export const addMonths = ({ y, m }: Ym, n: number): Ym => {
  const i = y * 12 + (m - 1) + n;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
};
export const cmpYm = (a: Ym, b: Ym) => a.y * 12 + a.m - (b.y * 12 + b.m);

/** The month's weeks: 7 cells each, null outside the month. */
export function monthWeeks({ y, m }: Ym): (string | null)[][] {
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks: (string | null)[][] = [];
  const prefix = `${y}-${String(m).padStart(2, "0")}-`;
  for (let w = 0; w * 7 < lead + days; w++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < 7; c++) {
      const d = w * 7 + c - lead + 1;
      row.push(d >= 1 && d <= days ? `${prefix}${String(d).padStart(2, "0")}` : null);
    }
    weeks.push(row);
  }
  return weeks;
}

/** Date.UTC of a month's first day (for Intl month labels with timeZone UTC). */
export const monthUtc = ({ y, m }: Ym) => Date.UTC(y, m - 1, 1);
