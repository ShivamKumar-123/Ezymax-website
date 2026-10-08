"use client";

import * as React from "react";
import { Download, Languages, Search, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Flag, PageHeader, Progress, Reveal, Segmented, Toggle, Tooltip, cn } from "@ezymex/ui";
import { I18N_COVERAGE, I18N_LANGS, I18N_NAMESPACES, I18N_NAMESPACE_KEYS, I18N_OVERRIDES, I18N_ROWS, I18N_TENANTS, I18N_TOTAL_KEYS, type I18nNamespace } from "@ezymex/mock/admin-translations";
import { SaveBar } from "@/components/settings/kit";

type Cell = { value: string | null; mt?: boolean; edited?: boolean };
type Grid = Record<string, Record<string, Cell>>; // key -> lang -> cell

const initGrid = (): Grid => Object.fromEntries(I18N_ROWS.map((r) => [r.key, Object.fromEntries(Object.entries(r.values).map(([l, v]) => [l, { value: v }]))]));
const LANG = Object.fromEntries(I18N_LANGS.map((l) => [l.code, l]));

export default function TranslationsPage() {
  const [grid, setGrid] = React.useState<Grid>(initGrid);
  const [savedGrid, setSavedGrid] = React.useState<Grid>(grid);
  const [langs, setLangs] = React.useState<string[]>(["en", "ar", "hi", "ur", "fa"]);
  const [ns, setNs] = React.useState<"all" | I18nNamespace>("all");
  const [q, setQ] = React.useState("");
  const [missingOnly, setMissingOnly] = React.useState(false);
  const [tenant, setTenant] = React.useState<string>("default");

  const dirty = JSON.stringify(grid) !== JSON.stringify(savedGrid);

  // baseline missing in sample rows (for live coverage adjustment)
  const filled = (code: string) => I18N_ROWS.filter((r) => r.values[code] === null && grid[r.key]![code]!.value).length;

  const toggleLang = (code: string) => {
    if (code === "en") return void toast.info("English is the source language", { description: "It is always shown and edited in the product repository." });
    if (langs.includes(code)) return setLangs(langs.filter((x) => x !== code));
    if (langs.length >= 7) return void toast.warning("Up to 6 languages next to English", { description: "Deselect one to add another." });
    setLangs([...langs, code]);
  };

  const rows = I18N_ROWS.filter((r) => {
    if (ns !== "all" && r.namespace !== ns) return false;
    if (q && !`${r.key} ${grid[r.key]!.en!.value}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (missingOnly && !langs.some((l) => !grid[r.key]![l]!.value)) return false;
    return true;
  });
  const visibleMissing = rows.reduce((s, r) => s + langs.filter((l) => !grid[r.key]![l]!.value).length, 0);

  const setCell = (key: string, lang: string, value: string) => setGrid((g) => ({ ...g, [key]: { ...g[key]!, [lang]: { value: value || null, edited: true } } }));

  const machineTranslate = () => {
    if (!visibleMissing) return toast.info("Nothing to translate", { description: "All visible cells already have a value." });
    const id = toast.loading(`Translating ${visibleMissing} strings with DeepL…`);
    setTimeout(() => {
      setGrid((g) => {
        const n = { ...g };
        for (const r of rows)
          for (const l of langs)
            if (!n[r.key]![l]!.value) n[r.key] = { ...n[r.key]!, [l]: { value: r.mt[l] ?? n[r.key]!.en!.value, mt: true, edited: true } };
        return n;
      });
      toast.success(`${visibleMissing} strings machine-translated`, { id, description: "Marked MT · a native reviewer must approve before they go live." });
    }, 1100);
  };

  const overridesFor = (key: string) => I18N_OVERRIDES.filter((o) => o.key === key);

  return (
    <div className="pb-24">
      <PageHeader
        title="Translations"
        subtitle={`${I18N_TOTAL_KEYS.toLocaleString("en-US")} keys across ${I18N_LANGS.length} languages. Tenants can override any string for their brand.`}
        actions={
          <>
            <Button variant="surface" onClick={() => toast.success("Import queued", { description: "Upload XLIFF, JSON or CSV · keys are matched by id" })}>
              <Upload /> Import
            </Button>
            <Button variant="surface" onClick={() => toast.success("Export ready", { description: `ezymex-i18n-${langs.join("-")}.json · ${I18N_TOTAL_KEYS} keys` })}>
              <Download /> Export
            </Button>
            <Button variant="ember" shimmer onClick={machineTranslate}>
              <Wand2 /> Machine-translate missing
            </Button>
          </>
        }
      />

      {/* ---------------- Coverage ---------------- */}
      <Reveal>
        <Card>
          <CardHeader
            title="Coverage by language"
            subtitle="Click a language to add it to the editor grid · RTL languages render right-to-left"
            icon={<Languages />}
            action={
              <div className="flex items-center gap-3 text-[12px] text-fg-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-up" /> ≥ 98%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-gold" /> 90–98%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-down" /> &lt; 90%
                </span>
              </div>
            }
          />
          <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-4 sm:grid-cols-3 sm:px-6 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-11">
            {I18N_COVERAGE.map((l) => {
              const missing = Math.max(0, l.keysMissing - filled(l.code));
              const pct = ((I18N_TOTAL_KEYS - missing) / I18N_TOTAL_KEYS) * 100;
              const on = langs.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => toggleLang(l.code)}
                  className={cn("k-row px-3 py-2.5 text-left transition-all", on ? "border-ember/40 bg-ember-soft/60 shadow-[0_0_20px_-10px_rgba(255,90,31,0.9)]" : "hover:bg-surface-3")}
                >
                  <div className="flex items-center gap-2">
                    <Flag country={l.flag} className="size-4" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{l.name}</span>
                    {l.rtl && <span className="text-[9.5px] font-semibold tracking-wider text-info">RTL</span>}
                  </div>
                  <div className="k-num mt-2 text-[15px] font-semibold">{pct.toFixed(1)}%</div>
                  <Progress value={pct} tone={pct >= 98 ? "up" : pct >= 90 ? "gold" : "down"} className="mt-1.5 h-1" />
                  <div className={cn("k-num mt-1.5 truncate text-[10.5px]", missing ? "text-fg-3" : "text-up")}>{missing ? `${missing} missing` : "complete"}</div>
                </button>
              );
            })}
          </div>
        </Card>
      </Reveal>

      {/* ---------------- Grid ---------------- */}
      <Reveal delay={0.05} className="mt-4">
        <Card>
          <div className="flex flex-col gap-3 px-4 pt-5 sm:px-6 xl:flex-row xl:items-center">
            <div className="-mx-1 overflow-x-auto px-1">
              <Segmented
                size="sm"
                value={ns}
                onChange={setNs}
                options={[{ value: "all" as const, label: "All namespaces" }, ...I18N_NAMESPACES.map((n) => ({ value: n, label: <>{n} <span className="k-num text-fg-3">{I18N_NAMESPACE_KEYS[n]}</span></> }))]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
                <Toggle checked={missingOnly} onChange={setMissingOnly} label="Missing only" /> Missing only
              </label>
              <div className="relative flex h-9 items-center rounded-full border border-line bg-surface-2 px-3.5 text-[13px]">
                <select value={tenant} onChange={(e) => setTenant(e.target.value)} className="cursor-pointer appearance-none bg-transparent pr-1 text-fg outline-none [&>option]:bg-surface" aria-label="Tenant">
                  <option value="default">Platform default</option>
                  {I18N_TENANTS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} overrides
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5">
                <Search className="size-3.5 text-fg-3" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key or English text…" className="w-44 bg-transparent text-[13px] outline-none placeholder:text-fg-3 sm:w-56" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[12px] text-fg-3 sm:px-6">
            Editing
            {langs.map((l) => (
              <button key={l} type="button" onClick={() => toggleLang(l)} disabled={l === "en"} className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 text-[11.5px] text-fg-2 enabled:hover:border-down/40 enabled:hover:text-down">
                <Flag country={LANG[l]!.flag} className="size-3.5" />
                {LANG[l]!.name}
                {l !== "en" && <span aria-hidden>×</span>}
              </button>
            ))}
            <span className="ml-auto">
              <span className="k-num text-warn">{visibleMissing}</span> missing in view · {rows.length} keys
            </span>
          </div>

          <div className="mt-3 overflow-x-auto px-4 pb-5 sm:px-6">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                  <th className="sticky left-0 z-10 w-[260px] rounded-l-[12px] bg-surface-2 px-3 py-2.5 font-medium">Key</th>
                  {langs.map((l, i) => (
                    <th key={l} className={cn("bg-surface-2 px-2 py-2.5 font-medium", i === langs.length - 1 && "rounded-r-[12px]")}>
                      <span className="flex items-center gap-1.5">
                        <Flag country={LANG[l]!.flag} className="size-3.5" />
                        {l}
                        {LANG[l]!.rtl && <span className="text-[9.5px] text-info">RTL</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ovs = overridesFor(r.key);
                  return (
                    <tr key={r.key} className="group">
                      <td className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-2 align-top">
                        <div className="truncate font-mono text-[12px] text-fg">{r.key}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Chip size="sm">{r.namespace}</Chip>
                          {ovs.length > 0 && (
                            <Tooltip
                              content={
                                <div className="space-y-0.5">
                                  {ovs.map((o) => (
                                    <div key={o.tenant + o.lang}>
                                      {I18N_TENANTS.find((t) => t.id === o.tenant)?.name} · {o.lang.toUpperCase()}: “{o.value}”
                                    </div>
                                  ))}
                                </div>
                              }
                            >
                              <span>
                                <Chip size="sm" tone="gold">
                                  {ovs.length} tenant override{ovs.length > 1 ? "s" : ""}
                                </Chip>
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                      {langs.map((l) => {
                        const c = grid[r.key]![l]!;
                        const ov = tenant !== "default" ? ovs.find((o) => o.tenant === tenant && o.lang === l) : undefined;
                        const missing = !c.value;
                        return (
                          <td key={l} className="border-b border-line px-1 py-1.5 align-top">
                            <div
                              className={cn(
                                "relative rounded-[10px] border transition-colors focus-within:border-ember/50 focus-within:bg-surface-2",
                                ov ? "border-gold/40 bg-gold-soft" : missing ? "border-dashed border-warn/45 bg-warn-soft" : c.edited ? "border-ember/30 bg-ember-soft/40" : "border-transparent hover:border-line hover:bg-surface-2",
                              )}
                            >
                              <input
                                value={ov ? ov.value : c.value ?? ""}
                                readOnly={!!ov || l === "en"}
                                dir={LANG[l]!.rtl ? "rtl" : "ltr"}
                                placeholder="Missing"
                                onChange={(e) => setCell(r.key, l, e.target.value)}
                                className={cn("h-9 w-full min-w-[150px] bg-transparent px-2.5 text-[12.5px] text-fg outline-none placeholder:text-warn/80", l === "en" && "text-fg-2")}
                                title={ov ? `Override by ${ov.by}` : c.value ?? "Missing"}
                              />
                              {(c.mt || ov) && (
                                <span className={cn("pointer-events-none absolute -top-1.5 rounded-full px-1.5 text-[9px] font-semibold", LANG[l]!.rtl ? "left-1.5" : "right-1.5", ov ? "bg-gold text-[#1a1204]" : "bg-info text-[#04121a]")}>{ov ? "OVERRIDE" : "MT"}</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={langs.length + 1} className="py-14 text-center text-fg-3">
                      No keys match. Try another namespace or clear “Missing only”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-3 text-[11.5px] text-fg-3">
              Showing a working sample of {I18N_ROWS.length} keys. English is the source language and is edited in the product repository.
            </p>
          </div>
        </Card>
      </Reveal>

      <SaveBar
        dirty={dirty}
        label={`${Object.values(grid).reduce((s, row) => s + Object.values(row).filter((c) => c.edited).length, 0) - Object.values(savedGrid).reduce((s, row) => s + Object.values(row).filter((c) => c.edited).length, 0)} strings changed`}
        onReset={() => setGrid(savedGrid)}
        onSave={() => {
          setSavedGrid(grid);
          toast.success("Translations published", { description: "CDN bundles rebuilt · clients get new strings on next page load" });
        }}
      />
    </div>
  );
}
