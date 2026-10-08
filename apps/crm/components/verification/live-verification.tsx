"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Check, FileText, IdCard, Lock, Plus, ScanFace, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Field, Input, PageHeader, Reveal, Skeleton, Stepper, cn } from "@/components/kit";
import { useT } from "@ezymex/i18n/react";
import { COUNTRIES, maxDob } from "@/lib/countries";
import { useSession } from "@/components/session";
import { ID_TYPES, kycPost, sameSlot, useKyc, type Address, type Company, type IdType, type KycDocument, type KycState, type Party, type Slot } from "./api";
import { ASPECT, DocSlot, PoaSlot, previewFor } from "./capture";
import { CheckingSequence, StatusTracker, hoursLabel, submissionChecks } from "./tracker";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const SELECT = "h-11 w-full rounded-[14px] border border-line bg-surface-2 px-3.5 text-sm outline-none focus:border-ember/50";

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function CountrySelect({ value, onChange, label, extra }: { value: string; onChange: (v: string) => void; label: string; extra?: string }) {
  const t = useT();
  const codes = new Set<string>(COUNTRIES.map((c) => c[0]));
  const list = [...COUNTRIES.map((c) => ({ code: c[0] as string, name: c[1] as string }))];
  for (const x of [extra, value]) if (x && !codes.has(x)) list.push({ code: x, name: countryName(x) });
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={SELECT}>
      <option value="">{t("kyc.wizard.choose")}</option>
      {list.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function docFor(state: KycState, slot: Slot): KycDocument | null {
  return state.documents.filter((d) => sameSlot(d, slot) && (d.status === "uploaded" || d.status === "accepted")).at(-1) ?? null;
}

function useSave() {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<{ field?: string; message: string } | null>(null);
  const run = React.useCallback(async (body: unknown, apply: (s: KycState) => void) => {
    setBusy(true);
    setErr(null);
    const r = await kycPost("details", body);
    setBusy(false);
    if (!r.ok) {
      setErr({ field: r.error.field, message: r.error.message });
      toast.error(r.error.message);
      return false;
    }
    apply(r.data);
    return true;
  }, []);
  return { busy, err, run };
}

function StepNav({ onBack, onNext, nextLabel, disabled, busy }: { onBack?: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean; busy?: boolean }) {
  const t = useT();
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="rtl:-scale-x-100" /> {t("common.back")}
        </Button>
      ) : (
        <span />
      )}
      <Button variant="ember" onClick={onNext} disabled={disabled || busy} data-testid="step-next">
        {busy ? t("kyc.wizard.saving") : (nextLabel ?? t("common.continue"))} {!busy && <ArrowRight className="rtl:-scale-x-100" />}
      </Button>
    </div>
  );
}

function StepTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-0.5 text-[13px] text-fg-3">{text}</p>
    </div>
  );
}

const fade = { initial: { opacity: 0, x: 10 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -10 }, transition: { duration: 0.18 } };

/* ------------------------------------------------------------------ */
/* Step: personal details (identity + residential address)              */
/* ------------------------------------------------------------------ */

function DetailsStep({ state, onSaved }: { state: KycState; onSaved: (s: KycState) => void }) {
  const t = useT();
  const p = state.profile;
  const [first, setFirst] = React.useState(p.first_name);
  const [last, setLast] = React.useState(p.last_name);
  const [dob, setDob] = React.useState(p.date_of_birth);
  const a = state.case?.details.address;
  const [addr, setAddr] = React.useState<Address>(a ?? { line1: "", line2: "", city: "", postcode: "", country: p.country });
  const { busy, err, run } = useSave();
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr((x) => ({ ...x, [k]: e.target.value }));
  const fieldErr = (f: string) => (err?.field === f ? err.message : undefined);
  return (
    <motion.div key="details" {...fade}>
      <StepTitle title={t("kyc.details.title")} text={t("kyc.details.text")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("kyc.details.firstNames")} error={fieldErr("first_name")}>
          <Input value={first} onChange={(e) => setFirst(e.target.value)} disabled={state.identity_locked} aria-label={t("kyc.details.firstName")} autoComplete="given-name" />
        </Field>
        <Field label={t("kyc.details.lastName")} error={fieldErr("last_name")}>
          <Input value={last} onChange={(e) => setLast(e.target.value)} disabled={state.identity_locked} aria-label={t("kyc.details.lastName")} autoComplete="family-name" />
        </Field>
        <Field label={t("kyc.details.dob")} error={fieldErr("date_of_birth")}>
          <Input type="date" value={dob} max={maxDob()} onChange={(e) => setDob(e.target.value)} disabled={state.identity_locked} aria-label={t("kyc.details.dob")} />
        </Field>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[12px] text-fg-3">
        <Lock className="size-3.5" /> {t("kyc.details.lockedNote")}
      </div>

      <div className="mt-6 mb-3 text-[14px] font-medium">{t("kyc.details.residentialAddress")}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("kyc.details.street")} error={fieldErr("address.line1")} className="sm:col-span-2">
          <Input value={addr.line1} onChange={set("line1")} placeholder={t("kyc.details.streetPlaceholder")} aria-label={t("kyc.details.street")} autoComplete="address-line1" />
        </Field>
        <Field label={t("kyc.details.apartment")} className="sm:col-span-2">
          <Input value={addr.line2} onChange={set("line2")} aria-label={t("kyc.details.apartmentAria")} autoComplete="address-line2" />
        </Field>
        <Field label={t("kyc.details.city")} error={fieldErr("address.city")}>
          <Input value={addr.city} onChange={set("city")} aria-label={t("kyc.details.city")} autoComplete="address-level2" />
        </Field>
        <Field label={t("kyc.details.postcode")}>
          <Input value={addr.postcode} onChange={set("postcode")} aria-label={t("kyc.details.postcodeAria")} autoComplete="postal-code" />
        </Field>
        <Field label={t("kyc.details.countryOfResidence")} error={fieldErr("address.country")} className="sm:col-span-2">
          <CountrySelect value={addr.country} onChange={(v) => setAddr((x) => ({ ...x, country: v }))} label={t("kyc.details.countryOfResidence")} extra={p.country} />
        </Field>
      </div>
      <StepNav
        busy={busy}
        disabled={!addr.line1.trim() || !addr.city.trim() || !addr.country}
        onNext={() => void run({ identity: state.identity_locked ? undefined : { first_name: first, last_name: last, date_of_birth: dob }, address: addr }, onSaved)}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: identity document                                              */
/* ------------------------------------------------------------------ */

function IdStep({ state, onSaved, onBack, onNext }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void; onNext: () => void }) {
  const tt = useT();
  const t = state.case?.id_doc_type ?? null;
  const { busy, run } = useSave();
  const front: Slot = { kind: "id_document", side: "front" };
  const back: Slot = { kind: "id_document", side: "back" };
  const passport = t === "passport";
  const done = !!t && !!docFor(state, front) && (passport || !!docFor(state, back));
  return (
    <motion.div key="id" {...fade}>
      <StepTitle title={tt("kyc.id.title")} text={tt("kyc.id.text")} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={tt("kyc.id.documentType")}>
        {ID_TYPES.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={t === o.value}
            disabled={busy}
            onClick={() => t !== o.value && void run({ id_doc_type: o.value }, onSaved)}
            className={cn("flex items-center gap-3 rounded-[14px] border px-4 py-3 text-start transition-colors", t === o.value ? "border-ember/60 bg-ember-soft/50" : "border-line bg-surface-2 hover:border-fg-3")}
          >
            <IdCard className={cn("size-5 shrink-0", t === o.value ? "text-ember" : "text-fg-3")} />
            <span>
              <span className="block text-[13.5px] font-medium">{tt(o.label)}</span>
              <span className="block text-[11.5px] text-fg-3">{tt(o.hint)}</span>
            </span>
          </button>
        ))}
      </div>
      {t && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <DocSlot
            key={`front-${t}`}
            slot={front}
            label={passport ? tt("kyc.id.passportPage") : tt("kyc.id.frontSide")}
            hint={passport ? tt("kyc.id.passportPageHint") : tt("kyc.id.frontSideHint")}
            purpose="id"
            aspect={passport ? ASPECT.passport : ASPECT.card}
            passport={passport}
            doc={docFor(state, front)}
            onUploaded={onSaved}
          />
          {!passport && (
            <DocSlot key={`back-${t}`} slot={back} label={tt("kyc.id.backSide")} hint={tt("kyc.id.backSideHint")} purpose="id" aspect={ASPECT.card} doc={docFor(state, back)} onUploaded={onSaved} />
          )}
        </div>
      )}
      <StepNav onBack={onBack} onNext={onNext} disabled={!done} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Corporate: company, people                                           */
/* ------------------------------------------------------------------ */

function CompanyStep({ state, onSaved }: { state: KycState; onSaved: (s: KycState) => void }) {
  const t = useT();
  const init = state.case?.details.company;
  const [c, setC] = React.useState<Company>(init ?? { name: "", reg_number: "", country: state.profile.country, incorporated_on: "", business: "", address: { line1: "", line2: "", city: "", postcode: "", country: state.profile.country } });
  const { busy, err, run } = useSave();
  const set = (k: keyof Company) => (e: React.ChangeEvent<HTMLInputElement>) => setC((x) => ({ ...x, [k]: e.target.value }));
  const setA = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setC((x) => ({ ...x, address: { ...x.address, [k]: e.target.value } }));
  const fe = (f: string) => (err?.field === f ? err.message : undefined);
  return (
    <motion.div key="company" {...fade}>
      <StepTitle title={t("kyc.company.title")} text={t("kyc.company.text")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("kyc.company.name")} error={fe("company.name")} className="sm:col-span-2">
          <Input value={c.name} onChange={set("name")} aria-label={t("kyc.company.nameAria")} />
        </Field>
        <Field label={t("kyc.company.regNumber")} error={fe("company.reg_number")}>
          <Input value={c.reg_number} onChange={set("reg_number")} aria-label={t("kyc.company.regNumber")} />
        </Field>
        <Field label={t("kyc.company.incorporatedOn")} error={fe("company.incorporated_on")}>
          <Input type="date" value={c.incorporated_on} onChange={set("incorporated_on")} aria-label={t("kyc.company.incorporatedOn")} />
        </Field>
        <Field label={t("kyc.company.country")} error={fe("company.country")}>
          <CountrySelect value={c.country} onChange={(v) => setC((x) => ({ ...x, country: v }))} label={t("kyc.company.country")} />
        </Field>
        <Field label={t("kyc.company.business")}>
          <Input value={c.business} onChange={set("business")} aria-label={t("kyc.company.businessAria")} />
        </Field>
      </div>
      <div className="mt-6 mb-3 text-[14px] font-medium">{t("kyc.company.registeredAddress")}</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("kyc.details.street")} error={fe("company.address.line1")} className="sm:col-span-2">
          <Input value={c.address.line1} onChange={setA("line1")} aria-label={t("kyc.company.streetAria")} />
        </Field>
        <Field label={t("kyc.details.city")} error={fe("company.address.city")}>
          <Input value={c.address.city} onChange={setA("city")} aria-label={t("kyc.company.cityAria")} />
        </Field>
        <Field label={t("kyc.details.postcode")}>
          <Input value={c.address.postcode} onChange={setA("postcode")} aria-label={t("kyc.company.postcodeAria")} />
        </Field>
        <Field label={t("kyc.company.addressCountry")} className="sm:col-span-2">
          <CountrySelect value={c.address.country} onChange={(v) => setC((x) => ({ ...x, address: { ...x.address, country: v } }))} label={t("kyc.company.addressCountryAria")} />
        </Field>
      </div>
      <StepNav busy={busy} disabled={!c.name.trim() || !c.reg_number.trim() || !c.incorporated_on || !c.address.line1.trim()} onNext={() => void run({ company: c }, onSaved)} />
    </motion.div>
  );
}

const EMPTY_PARTY: Party = { first_name: "", last_name: "", date_of_birth: "", nationality: "", roles: ["director"], ownership: null, id_type: "passport" };

function PartiesStep({ state, onSaved, onBack }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void }) {
  const t = useT();
  const [list, setList] = React.useState<Party[]>(state.case?.details.parties?.length ? state.case.details.parties : [{ ...EMPTY_PARTY, first_name: state.profile.first_name, last_name: state.profile.last_name, date_of_birth: state.profile.date_of_birth, nationality: state.profile.country }]);
  const { busy, err, run } = useSave();
  const upd = (i: number, patch: Partial<Party>) => setList((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const toggleRole = (i: number, r: "director" | "ubo") => upd(i, { roles: list[i]!.roles.includes(r) ? list[i]!.roles.filter((x) => x !== r) : [...list[i]!.roles, r] });
  return (
    <motion.div key="parties" {...fade}>
      <StepTitle title={t("kyc.parties.title")} text={t("kyc.parties.text")} />
      <div className="space-y-3">
        {list.map((p, i) => (
          <div key={i} className="rounded-[16px] border border-line bg-surface-2 p-4" data-testid={`party-${i}`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13.5px] font-medium">{t("kyc.parties.person", { n: i + 1 })}</div>
              {list.length > 1 && (
                <Button variant="ghost" size="xs" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label={t("kyc.parties.removePerson", { n: i + 1 })}>
                  <Trash2 /> {t("common.remove")}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("kyc.details.firstName")}>
                <Input value={p.first_name} onChange={(e) => upd(i, { first_name: e.target.value })} aria-label={t("kyc.parties.firstNameAria", { n: i + 1 })} />
              </Field>
              <Field label={t("kyc.details.lastName")}>
                <Input value={p.last_name} onChange={(e) => upd(i, { last_name: e.target.value })} aria-label={t("kyc.parties.lastNameAria", { n: i + 1 })} />
              </Field>
              <Field label={t("kyc.details.dob")}>
                <Input type="date" value={p.date_of_birth} max={maxDob()} onChange={(e) => upd(i, { date_of_birth: e.target.value })} aria-label={t("kyc.parties.dobAria", { n: i + 1 })} />
              </Field>
              <Field label={t("kyc.parties.nationality")}>
                <CountrySelect value={p.nationality} onChange={(v) => upd(i, { nationality: v })} label={t("kyc.parties.nationalityAria", { n: i + 1 })} />
              </Field>
              <Field label={t("kyc.parties.idDocument")}>
                <select value={p.id_type} onChange={(e) => upd(i, { id_type: e.target.value as IdType })} className={SELECT} aria-label={t("kyc.parties.idTypeAria", { n: i + 1 })}>
                  {ID_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("kyc.parties.ownership")}>
                <Input type="number" min={0} max={100} step="0.01" value={p.ownership ?? ""} onChange={(e) => upd(i, { ownership: e.target.value === "" ? null : Number(e.target.value) })} aria-label={t("kyc.parties.ownershipAria", { n: i + 1 })} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
              {(["director", "ubo"] as const).map((r) => (
                <label key={r} className="flex items-center gap-2">
                  <input type="checkbox" checked={p.roles.includes(r)} onChange={() => toggleRole(i, r)} className="size-4 accent-[var(--k-ember)]" />
                  {r === "director" ? t("kyc.parties.director") : t("kyc.parties.uboCheckbox")}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      {err?.field === "parties" && <p className="mt-3 text-[12.5px] text-down">{err.message}</p>}
      {list.length < 10 && (
        <Button variant="surface" size="sm" className="mt-3" onClick={() => setList((l) => [...l, { ...EMPTY_PARTY }])}>
          <Plus /> {t("kyc.parties.addPerson")}
        </Button>
      )}
      <StepNav onBack={onBack} busy={busy} onNext={() => void run({ parties: list }, onSaved)} />
    </motion.div>
  );
}

function CorpDocsStep({ state, onSaved, onBack, onNext }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const parties = state.case?.details.parties ?? [];
  const inc: Slot = { kind: "incorporation", side: "single" };
  const addr: Slot = { kind: "company_address", side: "single" };
  const ready = state.required.filter((r) => r.kind !== "selfie").every((r) => r.uploaded);
  return (
    <motion.div key="corpdocs" {...fade}>
      <StepTitle title={t("kyc.corpDocs.title")} text={t("kyc.corpDocs.text")} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DocSlot slot={inc} label={t("kyc.corpDocs.incorporation")} hint={t("kyc.corpDocs.incorporationHint")} purpose="doc" aspect={ASPECT.a4} doc={docFor(state, inc)} onUploaded={onSaved} />
        <PoaSlot slot={addr} label={t("kyc.corpDocs.companyPoa")} doc={docFor(state, addr)} onUploaded={onSaved} company />
      </div>
      {parties.map((p) => {
        const passport = p.id_type === "passport";
        const idType = ID_TYPES.find((o) => o.value === p.id_type);
        const idLabel = idType ? t(idType.label) : "";
        const f: Slot = { kind: "party_id", side: "front", party: p.key };
        const b: Slot = { kind: "party_id", side: "back", party: p.key };
        return (
          <div key={p.key} className="mt-5">
            <div className="mb-2 text-[13.5px] font-medium">
              {p.first_name} {p.last_name} <span className="font-normal text-fg-3">· {p.roles.map((r) => (r === "ubo" ? t("kyc.parties.ubo") : t("kyc.parties.director"))).join(", ")}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <DocSlot slot={f} label={passport ? t("kyc.id.passportPage") : t("kyc.corpDocs.idFront")} hint={idLabel} purpose="id" aspect={passport ? ASPECT.passport : ASPECT.card} passport={passport} doc={docFor(state, f)} onUploaded={onSaved} />
              {!passport && <DocSlot slot={b} label={t("kyc.corpDocs.idBack")} hint={idLabel} purpose="id" doc={docFor(state, b)} onUploaded={onSaved} />}
            </div>
          </div>
        );
      })}
      <StepNav onBack={onBack} onNext={onNext} disabled={!ready} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Step: selfie, review                                                 */
/* ------------------------------------------------------------------ */

function SelfieStep({ state, onSaved, onBack, onNext }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const slot: Slot = { kind: "selfie", side: "single" };
  const doc = docFor(state, slot);
  return (
    <motion.div key="selfie" {...fade}>
      <StepTitle title={t("kyc.selfie.title")} text={t("kyc.selfie.text")} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <DocSlot slot={slot} label={t("kyc.selfie.label")} hint={t("kyc.selfie.hint")} purpose="selfie" doc={doc} preferCamera onUploaded={onSaved} />
        <ul className="space-y-2 text-[13px] text-fg-2">
          {(["kyc.selfie.tip.centre", "kyc.selfie.tip.remove", "kyc.selfie.tip.light", "kyc.selfie.tip.neutral"] as const).map((k) => (
            <li key={k} className="k-row flex items-center gap-3 px-4 py-3">
              <ScanFace className="size-4 shrink-0 text-fg-3" /> {t(k)}
            </li>
          ))}
        </ul>
      </div>
      <StepNav onBack={onBack} onNext={onNext} disabled={!doc} />
    </motion.div>
  );
}

function ReviewList({ state }: { state: KycState }) {
  const t = useT();
  return (
    <div className="space-y-2">
      {state.required.map((r) => {
        const doc = docFor(state, r);
        const local = previewFor(r);
        const warn = doc?.checks.client && Object.values(doc.checks.client).some((v) => v && typeof v === "object" && ("ok" in v ? v.ok === false : "found" in v ? v.found === false : false));
        return (
          <div key={`${r.kind}${r.side}${r.party}`} className="k-row flex items-center gap-3 px-4 py-3" data-testid="review-row">
            {local && local.mime.startsWith("image/") && !local.mime.includes("hei") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={local.url} alt="" className={cn("size-10 shrink-0 border border-line object-cover", r.kind === "selfie" ? "rounded-full" : "rounded-[8px]")} />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-[8px] border border-line bg-surface-3 text-fg-3">
                <FileText className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium">{r.label}</span>
              <span className="block text-[11.5px] text-fg-3">{doc ? `${doc.mime.replace("image/", "").replace("application/", "").toUpperCase()} · ${(doc.size_bytes / 1024 / 1024).toFixed(2)} MB` : t("kyc.review.missing")}</span>
            </span>
            {doc ? (
              <Chip size="sm" tone={warn ? "warn" : "up"}>
                {warn ? t("kyc.review.flagged") : t("kyc.review.passed")}
              </Chip>
            ) : (
              <Chip size="sm" tone="down">
                {t("kyc.review.missing")}
              </Chip>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <label className="mt-5 flex items-start gap-3 text-[13px] text-fg-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--k-ember)]" data-testid="consent" />
      {t("kyc.review.consent")}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function StartPanel({ state, onStarted }: { state: KycState; onStarted: (s: KycState) => void }) {
  const t = useT();
  const [kind, setKind] = React.useState<"individual" | "corporate">("individual");
  const [busy, setBusy] = React.useState(false);
  const again = state.case?.status === "rejected";
  async function go() {
    setBusy(true);
    const r = await kycPost("start", { kind });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    onStarted(r.data);
  }
  const need =
    kind === "individual"
      ? [
          [IdCard, t("kyc.start.need.idDoc")],
          [FileText, t("kyc.start.need.poa")],
          [ScanFace, t("kyc.start.need.selfie")],
        ]
      : [
          [Building2, t("kyc.start.need.companyDocs")],
          [UserRound, t("kyc.start.need.people")],
          [ScanFace, t("kyc.start.need.directorSelfie")],
        ];
  return (
    <div>
      <StepTitle title={again ? t("kyc.start.titleAgain") : t("kyc.start.title")} text={t("kyc.start.text", { minutes: kind === "individual" ? "3" : "10", hours: hoursLabel(state.review.typical_hours) })} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("kyc.start.typeLabel")}>
        {(
          [
            ["individual", UserRound, t("kyc.start.individual"), t("kyc.start.individualText")],
            ["corporate", Building2, t("kyc.start.company"), t("kyc.start.companyText")],
          ] as const
        ).map(([v, I, label, d]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={kind === v}
            onClick={() => setKind(v)}
            className={cn("flex items-center gap-3 rounded-[16px] border px-4 py-4 text-start transition-colors", kind === v ? "border-ember/60 bg-ember-soft/50" : "border-line bg-surface-2 hover:border-fg-3")}
          >
            <I className={cn("size-5 shrink-0", kind === v ? "text-ember" : "text-fg-3")} />
            <span>
              <span className="block text-[14px] font-medium">{label}</span>
              <span className="block text-[12px] text-fg-3">{d}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-5 text-[13px] font-medium">{t("kyc.start.needTitle")}</div>
      <ul className="mt-2 space-y-2">
        {need.map(([I, text]) => {
          const Ic = I as typeof IdCard;
          return (
            <li key={text as string} className="k-row flex items-center gap-3 px-4 py-3 text-[13px] text-fg-2">
              <Ic className="size-4 shrink-0 text-fg-3" /> {text as string}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex justify-end">
        <Button variant="ember" size="lg" onClick={() => void go()} disabled={busy} data-testid="kyc-start">
          {busy ? t("kyc.start.starting") : t("kyc.start.button")} <ArrowRight className="rtl:-scale-x-100" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

function firstIncomplete(state: KycState): number {
  const c = state.case!;
  if (c.kind === "corporate") {
    if (!c.details.company) return 0;
    if (!c.details.parties?.length) return 1;
    if (state.required.some((r) => r.kind !== "selfie" && !r.uploaded)) return 2;
    if (state.required.some((r) => r.kind === "selfie" && !r.uploaded)) return 3;
    return 4;
  }
  if (!c.details.address) return 0;
  if (!c.id_doc_type || state.required.some((r) => r.kind === "id_document" && !r.uploaded)) return 1;
  if (state.required.some((r) => r.kind === "proof_of_address" && !r.uploaded)) return 2;
  if (state.required.some((r) => r.kind === "selfie" && !r.uploaded)) return 3;
  return 4;
}

function Wizard({ state, setState, onSubmitted }: { state: KycState; setState: (s: KycState) => void; onSubmitted: (s: KycState) => void }) {
  const t = useT();
  const corporate = state.case!.kind === "corporate";
  const steps = corporate
    ? [t("kyc.steps.company"), t("kyc.steps.people"), t("kyc.steps.documents"), t("kyc.steps.selfie"), t("kyc.steps.review")]
    : [t("kyc.steps.yourDetails"), t("kyc.steps.identityDocument"), t("kyc.steps.proofOfAddress"), t("kyc.steps.selfie"), t("kyc.steps.review")];
  const [step, setStep] = React.useState(() => firstIncomplete(state));
  const [consent, setConsent] = React.useState(false);
  const [phase, setPhase] = React.useState<"form" | "checking">("form");
  const [result, setResult] = React.useState<KycState | null>(null);
  const [checkSteps, setCheckSteps] = React.useState(() => submissionChecks(state));
  const saved = (next: number | null) => (s: KycState) => {
    setState(s);
    if (next !== null) setStep(next);
  };
  const poa: Slot = { kind: "proof_of_address", side: "single" };

  async function submit() {
    setCheckSteps(submissionChecks(state));
    setPhase("checking");
    setResult(null);
    const r = await kycPost("submit", { confirm: true });
    if (!r.ok) {
      setPhase("form");
      return toast.error(r.error.message);
    }
    setResult(r.data);
  }

  if (phase === "checking") return <CheckingSequence steps={checkSteps} serverDone={!!result} onFinish={() => result && onSubmitted(result)} />;

  return (
    <div>
      <Stepper steps={steps} current={step} className="mb-6" />
      <AnimatePresence mode="wait">
        {corporate ? (
          step === 0 ? (
            <CompanyStep key="c0" state={state} onSaved={saved(1)} />
          ) : step === 1 ? (
            <PartiesStep key="c1" state={state} onSaved={saved(2)} onBack={() => setStep(0)} />
          ) : step === 2 ? (
            <CorpDocsStep key="c2" state={state} onSaved={saved(null)} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          ) : step === 3 ? (
            <SelfieStep key="c3" state={state} onSaved={saved(null)} onBack={() => setStep(2)} onNext={() => setStep(4)} />
          ) : null
        ) : step === 0 ? (
          <DetailsStep key="i0" state={state} onSaved={saved(1)} />
        ) : step === 1 ? (
          <IdStep key="i1" state={state} onSaved={saved(null)} onBack={() => setStep(0)} onNext={() => setStep(2)} />
        ) : step === 2 ? (
          <motion.div key="i2" {...fade}>
            <StepTitle title={t("kyc.poa.title")} text={t("kyc.poa.text")} />
            {state.case?.details.address && (
              <div className="mb-4 flex items-start gap-2 rounded-[14px] border border-line bg-surface-2 px-4 py-3 text-[12.5px] text-fg-2">
                <UserRound className="mt-0.5 size-4 shrink-0 text-fg-3" />
                <span>
                  {t("kyc.poa.addressOnFile", { address: [state.case.details.address.line1, state.case.details.address.line2, state.case.details.address.city, state.case.details.address.postcode, countryName(state.case.details.address.country)].filter(Boolean).join(", ") })}
                </span>
              </div>
            )}
            <PoaSlot slot={poa} label={t("kyc.poa.title")} doc={docFor(state, poa)} onUploaded={saved(null)} />
            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={!docFor(state, poa)} />
          </motion.div>
        ) : step === 3 ? (
          <SelfieStep key="i3" state={state} onSaved={saved(null)} onBack={() => setStep(2)} onNext={() => setStep(4)} />
        ) : null}
        {step === 4 && (
          <motion.div key="review" {...fade}>
            <StepTitle title={t("kyc.review.title")} text={t("kyc.review.text")} />
            <ReviewList state={state} />
            <Consent checked={consent} onChange={setConsent} />
            <StepNav onBack={() => setStep(3)} onNext={() => void submit()} nextLabel={t("kyc.wizard.submitForVerification")} disabled={!consent || state.required.some((r) => !r.uploaded)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* More information requested                                           */
/* ------------------------------------------------------------------ */

function MoreInfo({ state, setState, onSubmitted }: { state: KycState; setState: (s: KycState) => void; onSubmitted: (s: KycState) => void }) {
  const t = useT();
  const c = state.case!;
  const [phase, setPhase] = React.useState<"form" | "checking">("form");
  const [result, setResult] = React.useState<KycState | null>(null);
  const [consent, setConsent] = React.useState(false);
  const requested = state.required.filter((r) => r.requested);
  const ready = requested.every((r) => r.uploaded);
  const parties = c.details.parties ?? [];

  async function submit() {
    setPhase("checking");
    const r = await kycPost("submit", { confirm: true });
    if (!r.ok) {
      setPhase("form");
      return toast.error(r.error.message);
    }
    setResult(r.data);
  }
  if (phase === "checking")
    return <CheckingSequence steps={submissionChecks(state).filter((s) => ["received", "quality", "resolution", "poa", "face", "send"].includes(s.key))} serverDone={!!result} onFinish={() => result && onSubmitted(result)} />;

  return (
    <div data-testid="more-info">
      <div className="flex items-start gap-3 rounded-[16px] border border-warn/40 bg-warn-soft px-4 py-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-fg">{t("kyc.moreInfo.title")}</div>
          <p className="mt-0.5 text-[13px] text-fg-2">{t("kyc.moreInfo.text")}</p>
          {c.request_message && (
            <div className="mt-3 rounded-[12px] border border-line border-s-[3px] border-s-gold bg-surface px-3 py-2 text-[13px] text-fg-2">
              <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-fg-3">{t("kyc.wizard.noteFromTeam")}</div>
              {c.request_message}
            </div>
          )}
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {requested.map((r) => {
          const doc = docFor(state, r);
          const party = parties.find((p) => p.key === r.party);
          if (r.kind === "proof_of_address" || r.kind === "company_address")
            return <PoaSlot key={r.label} slot={r} label={r.label} doc={doc} requested onUploaded={setState} company={r.kind === "company_address"} />;
          const passport = r.kind === "id_document" ? c.id_doc_type === "passport" : r.kind === "party_id" ? party?.id_type === "passport" : false;
          const purpose = r.kind === "selfie" ? "selfie" : r.kind === "incorporation" ? "doc" : "id";
          return (
            <DocSlot
              key={r.label}
              slot={r}
              label={r.label}
              hint={r.kind === "selfie" ? t("kyc.selfie.hint") : t("kyc.moreInfo.docHint")}
              purpose={purpose}
              aspect={purpose === "doc" ? ASPECT.a4 : passport ? ASPECT.passport : ASPECT.card}
              passport={passport}
              doc={doc}
              requested
              preferCamera={r.kind === "selfie"}
              onUploaded={setState}
            />
          );
        })}
      </div>
      <Consent checked={consent} onChange={setConsent} />
      <div className="mt-5 flex justify-end">
        <Button variant="ember" onClick={() => void submit()} disabled={!ready || !consent} data-testid="resubmit">
          {t("kyc.moreInfo.send")} <ArrowRight className="rtl:-scale-x-100" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Levels({ state }: { state: KycState | null }) {
  const t = useT();
  const me = useSession();
  const verified = state?.kyc_status === "verified";
  const pending = state?.case && ["submitted", "in_review", "more_info"].includes(state.case.status);
  const levels = [
    { n: 0, name: t("kyc.levels.registered"), unlocks: [t("kyc.levels.unlock.demoAccounts"), t("kyc.levels.unlock.platformTools")], done: true },
    { n: 1, name: t("kyc.levels.contactVerified"), unlocks: [t("kyc.levels.unlock.liveAccounts"), t("kyc.levels.unlock.deposits"), t("kyc.levels.unlock.copyPamm")], done: me.email_verified },
    { n: 2, name: t("kyc.levels.identityVerified"), unlocks: [t("kyc.levels.unlock.withdrawals"), t("kyc.levels.unlock.partnerPayouts"), t("kyc.levels.unlock.higherLimits")], done: verified },
  ];
  return (
    <Card className="h-full">
      <CardHeader title={t("kyc.levels.title")} icon={<ShieldCheck />} />
      <div className="space-y-3 p-6 pt-4">
        {levels.map((l) => (
          <div key={l.n} className={cn("k-row p-4", !l.done && l.n === 2 && "border-ember/40 bg-ember-soft/40")}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className={cn("grid size-8 place-items-center rounded-full text-xs font-semibold", l.done ? "bg-up-soft text-up" : "bg-surface-3 text-fg-2")}>{l.done ? <Check className="size-4" strokeWidth={2.5} /> : l.n}</span>
                <div>
                  <div className="text-sm font-medium">{t("kyc.levels.level", { n: l.n })}</div>
                  <div className="text-xs text-fg-3">{l.name}</div>
                </div>
              </div>
              {l.done ? (
                <Chip size="sm" tone="up">
                  {t("kyc.levels.complete")}
                </Chip>
              ) : l.n === 2 && pending ? (
                <Chip size="sm" tone="warn" dot>
                  {state?.case?.status === "more_info" ? t("kyc.levels.actionNeeded") : t("kyc.levels.inReview")}
                </Chip>
              ) : (
                <Chip size="sm">{t("kyc.levels.notStarted")}</Chip>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {l.unlocks.map((u) => (
                <span key={u} className="flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">
                  {!l.done && <Lock className="size-2.5" />}
                  {u}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="px-1 pt-2 text-xs leading-relaxed text-fg-3">
          {t("kyc.levels.privacy")}
        </p>
        {state && state.history.length > 1 && (
          <div className="px-1 pt-2">
            <div className="mb-1.5 text-[12px] font-medium text-fg-2">{t("kyc.levels.previous")}</div>
            {state.history.slice(1).map((h) => (
              <div key={h.reference} className="flex justify-between text-[12px] text-fg-3">
                <span className="font-mono">{h.reference}</span>
                <span>{t.dyn(`kyc.history.status.${h.status}`, h.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function LiveVerification() {
  const t = useT();
  const [poll, setPoll] = React.useState<number | undefined>(undefined);
  const { data, setData, error, reload } = useKyc(poll);
  const [justSubmitted, setJustSubmitted] = React.useState(false);
  const [restart, setRestart] = React.useState(false);
  const status = data?.case?.status;
  React.useEffect(() => {
    setPoll(status === "submitted" || status === "in_review" ? 15_000 : undefined);
  }, [status]);

  const mode: "loading" | "start" | "wizard" | "more_info" | "tracker" = !data
    ? "loading"
    : !data.case || (restart && data.can_start)
      ? "start"
      : data.case.status === "draft"
        ? "wizard"
        : data.case.status === "more_info"
          ? "more_info"
          : "tracker";

  return (
    <div className="pb-16">
      <PageHeader
        title={t("kyc.page.title")}
        subtitle={t("kyc.page.subtitle")}
        actions={
          data?.case ? (
            <Chip tone={data.kyc_status === "verified" ? "up" : data.kyc_status === "rejected" ? "down" : "neutral"}>
              <span className="font-mono">{data.case.reference}</span>
            </Chip>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="order-2 xl:order-1 xl:col-span-1">
          <Levels state={data} />
        </Reveal>
        <Reveal delay={0.05} className="order-1 xl:order-2 xl:col-span-2">
          <Card className="h-full p-5 sm:p-6" data-testid="kyc-main" data-mode={mode}>
            {error && !data ? (
              <div className="py-10 text-center">
                <AlertTriangle className="mx-auto size-6 text-warn" />
                <p className="mt-2 text-[13.5px] text-fg-2">{error.message}</p>
                <Button variant="surface" size="sm" className="mt-4" onClick={reload}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : mode === "loading" ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
              </div>
            ) : mode === "start" ? (
              <StartPanel
                state={data!}
                onStarted={(s) => {
                  setRestart(false);
                  setData(s);
                }}
              />
            ) : mode === "wizard" ? (
              <Wizard
                key={data!.case!.id}
                state={data!}
                setState={setData}
                onSubmitted={(s) => {
                  setJustSubmitted(true);
                  setData(s);
                  toast.success(t("kyc.toast.submitted"), { description: t("kyc.toast.submittedDesc", { hours: hoursLabel(s.review.typical_hours) }) });
                }}
              />
            ) : mode === "more_info" ? (
              <MoreInfo
                state={data!}
                setState={setData}
                onSubmitted={(s) => {
                  setJustSubmitted(true);
                  setData(s);
                  toast.success(t("kyc.toast.sentToTeam"));
                }}
              />
            ) : (
              <StatusTracker state={data!} justSubmitted={justSubmitted} onRestart={() => setRestart(true)} />
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

