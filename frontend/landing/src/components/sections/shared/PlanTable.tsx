import { Reveal } from "@/components/ui/Reveal";
import type { PlanTable as PlanTableData } from "@/content/schema";

/**
 * A plain data table, for the Shield plan grid and the XP ladder.
 *
 * It replaced a Starter/Growth/Enterprise pricing comparison with tick-and-
 * cross cells. That shape belonged to a product sold on contracts; what this
 * site actually has is two flat tables of published figures.
 *
 * The first column is treated as the row label and the rest as values, which
 * is also what makes the stacked mobile layout read correctly.
 */
export function PlanTable({
  data,
  footnote,
}: {
  data: PlanTableData;
  footnote?: string;
}) {
  // The first column is the row label; the rest are values.
  const valueColumns = data.columns.slice(1);

  return (
    <div>
      {/* Desktop */}
      <Reveal>
        <div className="hidden overflow-hidden rounded-panel border border-line glass md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {data.columns.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="p-5 font-mono text-xs tracking-wide text-dim uppercase"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row[0]}
                  className="border-b border-line/60 last:border-0"
                >
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={
                        i === 0
                          ? "p-5 font-display text-sm font-semibold text-ink"
                          : "p-5 text-sm text-muted"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Mobile: one card per row, each value labelled by its column */}
      <div className="grid gap-3 md:hidden">
        {data.rows.map((row) => (
          <Reveal key={row[0]}>
            <div className="rounded-card border border-line glass p-5">
              <p className="font-display text-base font-semibold text-ink">
                {row[0]}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                {valueColumns.map((c, i) => (
                  <div key={c} className="contents">
                    <dt className="text-dim">{c}</dt>
                    <dd className="text-right text-ink">{row[i + 1]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        ))}
      </div>

      {footnote ? (
        <Reveal>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-dim">
            {footnote}
          </p>
        </Reveal>
      ) : null}
    </div>
  );
}
