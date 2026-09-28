import { toast } from "sonner";

/** Builds a CSV from plain rows and triggers a browser download. */
export function downloadCsv(name: string, rows: Record<string, string | number>[]) {
  if (!rows.length) {
    toast.error("Nothing to export", { description: "Adjust your filters and try again." });
    return;
  }
  const head = Object.keys(rows[0]!);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [head.join(","), ...rows.map((r) => head.map((h) => esc(r[h] ?? "")).join(","))].join("\n");
  try {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* ignore — toast still confirms */
  }
  toast.success(`${name}.csv exported`, { description: `${rows.length} rows · times in GMT+3` });
}

/** "24 Sep 2026, 14:03" in server time (GMT+3). */
export function serverTime(iso: string, withYear = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).format(new Date(iso));
}
