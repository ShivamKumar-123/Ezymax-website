// Verification flow on the phone, step for step the Client Area's (components/verification/live-verification.tsx):
//   start (individual | company) -> details -> identity document -> proof of address -> selfie -> review & submit
//   company: company -> people -> documents -> selfie -> review & submit
//   more information requested -> only the requested items -> send
// Every save goes to the gateway and answers with the new state; nothing is kept only on the phone.
import * as React from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { AlertTriangle, Building2, FileText, IdCard, Lock, Plus, ScanFace, Trash2, UserRound } from "lucide-react-native";
import { maxDob } from "@/features/auth/countries";
import { useT } from "@/i18n";
import type { ApiError } from "@/lib/api";
import { Button, Checkbox, ColorBlock, Display, FormError, Illustration, Pill, PressableScale, Text, TextField, toast } from "@/ui";
import { colors, GUTTER, radius, space } from "@/theme/tokens";
import { NextArrow, Note, StatusChip } from "../components/bits";
import { CountryField, DateField } from "../components/fields";
import { ageDays, countryName, isYmd } from "../format";
import { inkSoft, OK, tint } from "../tint";
import { applyKyc, hoursLabel, kycPost } from "./api";
import { flagged } from "./checks";
import { DocSlot, previewFor } from "./DocSlot";
import { CheckingSequence, submissionChecks } from "./Status";
import { ASPECT, docFor, ID_TYPES, POA_MAX_AGE_DAYS, POA_TYPES, type Address, type Company, type IdType, type KycState, type Party, type Slot } from "./types";

const Pad = ({ children, gap = space[4] }: { children: React.ReactNode; gap?: number }) => <View style={{ paddingHorizontal: GUTTER, gap }}>{children}</View>;

function StepTitle({ title, text }: { title: string; text?: string }) {
  return (
    <View style={{ gap: space[1] }}>
      <Display size="md">{title}</Display>
      {text ? <Text tone="secondary">{text}</Text> : null}
    </View>
  );
}

/** Segmented progress: done / current / to do. */
function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const t = useT();
  return (
    <View style={{ paddingHorizontal: GUTTER, gap: space[2] }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: steps.length, now: current + 1 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {steps.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < current ? OK : i === current ? colors.ember : colors.surface3 }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="label" tone="ember">
          {steps[current]}
        </Text>
        <Text variant="label" tone="tertiary">
          {t("mobileProfile.step", { n: current + 1, total: steps.length })}
        </Text>
      </View>
    </View>
  );
}

function StepNav({ onBack, onNext, nextLabel, disabled, busy, testID = "step-next" }: { onBack?: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean; busy?: boolean; testID?: string }) {
  const t = useT();
  return (
    <View style={{ gap: space[2], marginTop: space[2] }}>
      <Button label={busy ? t("kyc.wizard.saving") : (nextLabel ?? t("mobileProfile.kyc.continue"))} loading={busy} disabled={disabled || busy} onPress={onNext} trailing={!busy ? <NextArrow /> : undefined} testID={testID} />
      {onBack ? <Button label={t("common.back")} variant="ghost" onPress={onBack} /> : null}
    </View>
  );
}

/** Saves details; field errors come back from the gateway (`field`: "address.line1", "first_name"…). */
function useSave() {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<ApiError | null>(null);
  const run = React.useCallback(async (body: unknown, apply: (s: KycState) => void) => {
    setBusy(true);
    setErr(null);
    const r = await kycPost("details", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return false;
    }
    apply(r.data);
    return true;
  }, []);
  return { busy, err, run };
}

/** A row of choice cards (document type, verification type). */
function ChoiceCards<V extends string>({ value, options, onChange, disabled }: { value: V | null; options: { value: V; title: string; hint?: string; icon: typeof IdCard }[]; onChange: (v: V) => void; disabled?: boolean }) {
  return (
    <View style={{ gap: space[2] }} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <PressableScale
            key={o.value}
            onPress={() => !on && onChange(o.value)}
            disabled={disabled}
            haptics="select"
            scaleTo={0.985}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !!disabled }}
            testID={`choice-${o.value}`}
            style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: on ? colors.ember : colors.line, backgroundColor: on ? tint.ember : colors.surface }}
          >
            <Icon size={20} color={on ? colors.ember : colors.text3} />
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="700">
                {o.title}
              </Text>
              {o.hint ? (
                <Text variant="caption" tone="tertiary">
                  {o.hint}
                </Text>
              ) : null}
            </View>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.ember : colors.lineStrong, alignItems: "center", justifyContent: "center" }}>{on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ember }} /> : null}</View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

export function StartPanel({ state, onStarted, readOnly }: { state: KycState; onStarted: (s: KycState) => void; readOnly?: boolean }) {
  const t = useT();
  const [kind, setKind] = React.useState<"individual" | "corporate">("individual");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const again = state.case?.status === "rejected";
  const go = async () => {
    setBusy(true);
    setErr(null);
    const r = await kycPost("start", { kind });
    setBusy(false);
    if (!r.ok) return setErr(r.error.message);
    toast.show({ title: t("mobileProfile.kyc.startedToast"), tone: "success" });
    onStarted(r.data);
  };
  const need =
    kind === "individual"
      ? ([
          [IdCard, t("kyc.start.need.idDoc")],
          [FileText, t("kyc.start.need.poa")],
          [ScanFace, t("kyc.start.need.selfie")],
        ] as const)
      : ([
          [Building2, t("kyc.start.need.companyDocs")],
          [UserRound, t("kyc.start.need.people")],
          [ScanFace, t("kyc.start.need.directorSelfie")],
        ] as const);
  return (
    <Pad gap={space[5]}>
      {/* the hero: a matte ember block with the founder's "kyc pending" art, like the More tab's verification card */}
      <ColorBlock color="ember" padded={false} style={{ padding: space[5], minHeight: 176 }} testID="kyc-start-hero">
        <View style={{ gap: space[2], paddingEnd: 112 }}>
          <Display size="md" color={colors.ink} accessibilityRole="header">
            {again ? t("kyc.start.titleAgain") : t("kyc.start.title")}
          </Display>
          <Text variant="callout" color={inkSoft}>
            {t("kyc.start.text", { minutes: kind === "individual" ? "3" : "10", hours: hoursLabel(t, state.review.typical_hours) })}
          </Text>
        </View>
        <Illustration name="kycPending" width={132} height={132} style={{ position: "absolute", bottom: 0, end: 0 }} />
      </ColorBlock>
      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("mobileProfile.kyc.typeTitle")}
        </Text>
        <ChoiceCards
          value={kind}
          onChange={setKind}
          options={[
            { value: "individual", title: t("kyc.start.individual"), hint: t("kyc.start.individualText"), icon: UserRound },
            { value: "corporate", title: t("kyc.start.company"), hint: t("kyc.start.companyText"), icon: Building2 },
          ]}
        />
      </View>
      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="tertiary">
          {t("mobileProfile.kyc.needTitle")}
        </Text>
        {need.map(([Icon, text]) => (
          <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: space[3], padding: space[4], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
            <Icon size={18} color={colors.text3} />
            <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </View>
      <FormError message={err} />
      {!readOnly ? <Button label={busy ? t("kyc.start.starting") : t("kyc.start.button")} loading={busy} onPress={() => void go()} trailing={!busy ? <NextArrow /> : undefined} testID="kyc-start" /> : null}
    </Pad>
  );
}

/* ------------------------------------------------------------------ */
/* Individual: details                                                  */
/* ------------------------------------------------------------------ */

function DetailsStep({ state, onSaved }: { state: KycState; onSaved: (s: KycState) => void }) {
  const t = useT();
  const p = state.profile;
  const locked = state.identity_locked;
  const [first, setFirst] = React.useState(p.first_name);
  const [last, setLast] = React.useState(p.last_name);
  const [dob, setDob] = React.useState(p.date_of_birth ?? "");
  const a = state.case?.details.address;
  const [addr, setAddr] = React.useState<Address>(a ?? { line1: "", line2: "", city: "", postcode: "", country: p.country });
  const { busy, err, run } = useSave();
  const set = (k: keyof Address) => (v: string) => setAddr((x) => ({ ...x, [k]: v }));
  const fe = (f: string) => (err?.field === f ? err.message : undefined);
  const ready = !!addr.line1.trim() && !!addr.city.trim() && !!addr.country && (locked || (!!first.trim() && !!last.trim() && isYmd(dob)));
  return (
    <Pad>
      <StepTitle title={t("kyc.details.title")} text={t("kyc.details.text")} />
      <FormError message={err && !err.field ? err.message : null} />
      <TextField label={t("kyc.details.firstNames")} value={first} onChangeText={setFirst} editable={!locked} autoComplete="given-name" textContentType="givenName" error={fe("first_name")} />
      <TextField label={t("kyc.details.lastName")} value={last} onChangeText={setLast} editable={!locked} autoComplete="family-name" textContentType="familyName" error={fe("last_name")} />
      <DateField label={t("kyc.details.dob")} value={dob} onChange={setDob} editable={!locked} error={fe("date_of_birth")} hint={dob && dob > maxDob() ? t("auth.apiError.age") : undefined} />
      <Note icon={Lock}>{t("kyc.details.lockedNote")}</Note>
      <Text variant="label" tone="tertiary" style={{ marginTop: space[2] }}>
        {t("mobileProfile.kyc.addressTitle")}
      </Text>
      <TextField label={t("kyc.details.street")} value={addr.line1} onChangeText={set("line1")} placeholder={t("kyc.details.streetPlaceholder")} autoComplete="address-line1" textContentType="streetAddressLine1" error={fe("address.line1")} />
      <TextField label={t("kyc.details.apartment")} value={addr.line2} onChangeText={set("line2")} autoComplete="address-line2" textContentType="streetAddressLine2" />
      <TextField label={t("kyc.details.city")} value={addr.city} onChangeText={set("city")} autoComplete="postal-address-locality" textContentType="addressCity" error={fe("address.city")} />
      <TextField label={t("kyc.details.postcode")} value={addr.postcode} onChangeText={set("postcode")} autoComplete="postal-code" textContentType="postalCode" />
      <CountryField label={t("kyc.details.countryOfResidence")} value={addr.country} onChange={(v) => setAddr((x) => ({ ...x, country: v }))} extra={[p.country]} error={fe("address.country")} testID="kyc-country" />
      <StepNav busy={busy} disabled={!ready} onNext={() => void run({ identity: locked ? undefined : { first_name: first.trim(), last_name: last.trim(), date_of_birth: dob }, address: { ...addr, line1: addr.line1.trim(), city: addr.city.trim() } }, onSaved)} />
    </Pad>
  );
}

/* ------------------------------------------------------------------ */
/* Identity document                                                    */
/* ------------------------------------------------------------------ */

function IdStep({ state, onSaved, onBack, onNext }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const type = state.case?.id_doc_type ?? null;
  const { busy, err, run } = useSave();
  const front: Slot = { kind: "id_document", side: "front" };
  const back: Slot = { kind: "id_document", side: "back" };
  const passport = type === "passport";
  const done = !!type && !!docFor(state, front) && (passport || !!docFor(state, back));
  return (
    <Pad>
      <StepTitle title={t("kyc.id.title")} text={t("kyc.id.text")} />
      <Text variant="label" tone="tertiary">
        {t("mobileProfile.kyc.idTypeTitle")}
      </Text>
      <ChoiceCards<IdType> value={type} disabled={busy} onChange={(v) => void run({ id_doc_type: v }, onSaved)} options={ID_TYPES.map((o) => ({ value: o.value, title: t(o.label), hint: t(o.hint), icon: IdCard }))} />
      <FormError message={err?.message} />
      {type ? (
        <Animated.View entering={FadeIn.duration(160)} style={{ gap: space[3] }}>
          <DocSlot
            key={`front-${type}`}
            slot={front}
            label={passport ? t("kyc.id.passportPage") : t("kyc.id.frontSide")}
            hint={passport ? t("kyc.id.passportPageHint") : t("kyc.id.frontSideHint")}
            purpose="id"
            aspect={passport ? ASPECT.passport : ASPECT.card}
            passport={passport}
            doc={docFor(state, front)}
            onUploaded={onSaved}
          />
          {!passport ? <DocSlot key={`back-${type}`} slot={back} label={t("kyc.id.backSide")} hint={t("kyc.id.backSideHint")} purpose="id" aspect={ASPECT.card} doc={docFor(state, back)} onUploaded={onSaved} /> : null}
        </Animated.View>
      ) : null}
      <StepNav onBack={onBack} onNext={onNext} disabled={!done} />
    </Pad>
  );
}

/* ------------------------------------------------------------------ */
/* Proof of address                                                     */
/* ------------------------------------------------------------------ */

export function PoaSlot({ slot, label, doc, requested, onUploaded, company }: { slot: Slot; label: string; doc?: ReturnType<typeof docFor>; requested?: boolean; onUploaded: (s: KycState) => void; company?: boolean }) {
  const t = useT();
  const [type, setType] = React.useState<string>(doc?.doc_type ?? "utility_bill");
  const [date, setDate] = React.useState<string>(doc?.issue_date ?? "");
  const age = isYmd(date) ? ageDays(date) : null;
  const ok = age !== null && age >= 0 && age <= POA_MAX_AGE_DAYS;
  const poaType = POA_TYPES.find((o) => o.value === type);
  const typeLabel = poaType ? t(poaType.label).toLocaleLowerCase() : t("kyc.poa.document");
  const hint = age === null ? undefined : ok ? (age === 0 ? t("kyc.poa.issuedToday") : t("kyc.check.issuedDaysAgo", { count: age })) : undefined;
  const bad = age === null ? undefined : age < 0 ? t("kyc.poa.future") : age > POA_MAX_AGE_DAYS ? t(company ? "kyc.poa.tooOldCompany" : "kyc.poa.tooOld", { type: typeLabel }) : undefined;
  return (
    <View style={{ gap: space[3] }}>
      <Text variant="label" tone="tertiary">
        {t("mobileProfile.kyc.poaTypeTitle")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} accessibilityRole="radiogroup">
        {POA_TYPES.map((o) => (
          <Pill key={o.value} label={t(o.label)} selected={type === o.value} onPress={() => setType(o.value)} compact />
        ))}
      </View>
      <DateField label={t("kyc.poa.issueDateLabel")} value={date} onChange={setDate} error={bad} hint={hint} testID={`issue-${slot.kind}`} />
      <DocSlot
        slot={slot}
        label={label}
        hint={company ? t("kyc.poa.hintCompany") : t("kyc.poa.hint")}
        purpose="poa"
        aspect={ASPECT.a4}
        doc={doc}
        requested={requested}
        issueDate={ok ? date : undefined}
        docType={type}
        blocked={ok ? null : t("kyc.poa.blocked")}
        onUploaded={onUploaded}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Selfie, review                                                       */
/* ------------------------------------------------------------------ */

function SelfieStep({ state, onSaved, onBack, onNext }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const slot: Slot = { kind: "selfie", side: "single" };
  const doc = docFor(state, slot);
  return (
    <Pad>
      <StepTitle title={t("kyc.selfie.title")} text={t("kyc.selfie.text")} />
      <DocSlot slot={slot} label={t("kyc.selfie.label")} hint={t("kyc.selfie.hint")} purpose="selfie" aspect={3 / 4} doc={doc} onUploaded={onSaved} />
      <Text variant="label" tone="tertiary" style={{ marginTop: space[1] }}>
        {t("mobileProfile.kyc.selfieTips")}
      </Text>
      <View style={{ gap: space[2] }}>
        {(["kyc.selfie.tip.centre", "kyc.selfie.tip.remove", "kyc.selfie.tip.light", "kyc.selfie.tip.neutral"] as const).map((k) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <ScanFace size={16} color={colors.text3} />
            <Text variant="callout" tone="secondary" style={{ flex: 1 }}>
              {t(k)}
            </Text>
          </View>
        ))}
      </View>
      <StepNav onBack={onBack} onNext={onNext} disabled={!doc} />
    </Pad>
  );
}

function ReviewList({ state }: { state: KycState }) {
  const t = useT();
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, overflow: "hidden" }}>
      {state.required.map((r, i) => {
        const doc = docFor(state, r);
        const local = previewFor(r);
        const warn = flagged(doc?.checks.client);
        return (
          <View key={`${r.kind}${r.side}${r.party ?? ""}`} style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }} testID="review-row">
            <View style={{ width: 40, height: 40, borderRadius: r.kind === "selfie" ? 20 : radius.xs, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {local && local.mime.startsWith("image/") && !/hei/i.test(local.mime) ? <ReviewThumb uri={local.uri} /> : <FileText size={18} color={colors.text3} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="callout" weight="700" numberOfLines={2}>
                {r.label}
              </Text>
              <Text variant="caption" tone="tertiary">
                {doc ? `${doc.mime.replace("image/", "").replace("application/", "").toUpperCase()} · ${(doc.size_bytes / 1024 / 1024).toFixed(2)} MB` : t("kyc.review.missing")}
              </Text>
              {doc ? <StatusChip label={warn ? t("kyc.review.flagged") : t("kyc.review.passed")} tone={warn ? "gold" : "ok"} style={{ alignSelf: "flex-start" }} /> : <StatusChip label={t("kyc.review.missing")} tone="ember" style={{ alignSelf: "flex-start" }} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ReviewThumb({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={{ width: 40, height: 40 }} contentFit="cover" transition={0} />;
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <Checkbox checked={checked} onChange={onChange} accessibilityLabel={t("kyc.review.consent")}>
      <Text variant="callout" tone="secondary">
        {t("kyc.review.consent")}
      </Text>
    </Checkbox>
  );
}

/* ------------------------------------------------------------------ */
/* Company: details, people, documents                                   */
/* ------------------------------------------------------------------ */

function CompanyStep({ state, onSaved }: { state: KycState; onSaved: (s: KycState) => void }) {
  const t = useT();
  const init = state.case?.details.company;
  const [c, setC] = React.useState<Company>(init ?? { name: "", reg_number: "", country: state.profile.country, incorporated_on: "", business: "", address: { line1: "", line2: "", city: "", postcode: "", country: state.profile.country } });
  const { busy, err, run } = useSave();
  const set = (k: keyof Company) => (v: string) => setC((x) => ({ ...x, [k]: v }));
  const setA = (k: keyof Address) => (v: string) => setC((x) => ({ ...x, address: { ...x.address, [k]: v } }));
  const fe = (f: string) => (err?.field === f ? err.message : undefined);
  return (
    <Pad>
      <StepTitle title={t("kyc.company.title")} text={t("kyc.company.text")} />
      <Note>{t("mobileProfile.kyc.corporateStepsNote")}</Note>
      <FormError message={err && !err.field ? err.message : null} />
      <TextField label={t("kyc.company.name")} value={c.name} onChangeText={set("name")} error={fe("company.name")} />
      <TextField label={t("kyc.company.regNumber")} value={c.reg_number} onChangeText={set("reg_number")} autoCapitalize="characters" error={fe("company.reg_number")} />
      <DateField label={t("kyc.company.incorporatedOn")} value={c.incorporated_on} onChange={set("incorporated_on")} error={fe("company.incorporated_on")} />
      <CountryField label={t("kyc.company.country")} value={c.country} onChange={set("country")} error={fe("company.country")} />
      <TextField label={t("kyc.company.business")} value={c.business} onChangeText={set("business")} />
      <Text variant="label" tone="tertiary" style={{ marginTop: space[2] }}>
        {t("kyc.company.registeredAddress")}
      </Text>
      <TextField label={t("kyc.details.street")} value={c.address.line1} onChangeText={setA("line1")} error={fe("company.address.line1")} />
      <TextField label={t("kyc.details.city")} value={c.address.city} onChangeText={setA("city")} error={fe("company.address.city")} />
      <TextField label={t("kyc.details.postcode")} value={c.address.postcode} onChangeText={setA("postcode")} />
      <CountryField label={t("kyc.company.addressCountry")} value={c.address.country} onChange={setA("country")} />
      <StepNav busy={busy} disabled={!c.name.trim() || !c.reg_number.trim() || !isYmd(c.incorporated_on) || !c.address.line1.trim() || !c.address.city.trim()} onNext={() => void run({ company: c }, onSaved)} />
    </Pad>
  );
}

/** Ownership in % with up to two decimals, like the Client Area ("12.5"): the text is kept while typing ("12."), the
 *  number goes to the draft. */
function OwnershipField({ label, value, onChange, accessibilityLabel, error }: { label: string; value: number | null; onChange: (v: number | null) => void; accessibilityLabel: string; error?: string }) {
  const [text, setText] = React.useState(value === null ? "" : String(value));
  const parse = (v: string) => (v === "" || v === "." ? null : Number(v));
  React.useEffect(() => {
    // another value arrived from outside (a person above was removed): show it
    if (parse(text) !== value) setText(value === null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <TextField
      label={label}
      value={text}
      onChangeText={(v) => {
        let clean = v.replace(",", ".").replace(/[^0-9.]/g, "");
        const dot = clean.indexOf(".");
        if (dot >= 0) clean = `${clean.slice(0, dot + 1)}${clean.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
        if (Number(clean) > 100) clean = "100";
        setText(clean);
        onChange(parse(clean));
      }}
      keyboardType="decimal-pad"
      mono
      accessibilityLabel={accessibilityLabel}
      error={error}
    />
  );
}

const EMPTY_PARTY: Party = { first_name: "", last_name: "", date_of_birth: "", nationality: "", roles: ["director"], ownership: null, id_type: "passport" };

function PeopleStep({ state, onSaved, onBack }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void }) {
  const t = useT();
  const [list, setList] = React.useState<Party[]>(state.case?.details.parties?.length ? state.case.details.parties : [{ ...EMPTY_PARTY, first_name: state.profile.first_name, last_name: state.profile.last_name, date_of_birth: state.profile.date_of_birth, nationality: state.profile.country }]);
  const { busy, err, run } = useSave();
  const upd = (i: number, patch: Partial<Party>) => setList((l) => l.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const toggleRole = (i: number, r: "director" | "ubo") => upd(i, { roles: list[i]!.roles.includes(r) ? list[i]!.roles.filter((x) => x !== r) : [...list[i]!.roles, r] });
  const uboBad = (p: Party) => p.roles.includes("ubo") && (p.ownership === null || p.ownership < 25);
  const ready = list.length > 0 && list.every((p) => p.first_name.trim() && p.last_name.trim() && isYmd(p.date_of_birth) && p.nationality && p.roles.length && !uboBad(p));
  return (
    <Pad>
      <StepTitle title={t("kyc.parties.title")} text={t("kyc.parties.text")} />
      {list.map((p, i) => (
        <View key={i} style={{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }} testID={`party-${i}`}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="headline" weight="700">
              {t("mobileProfile.kyc.people.personTitle", { n: i + 1 })}
            </Text>
            {list.length > 1 ? (
              <PressableScale onPress={() => setList((l) => l.filter((_, j) => j !== i))} accessibilityLabel={t("kyc.parties.removePerson", { n: i + 1 })} scaleTo={1} style={{ minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
                <Trash2 size={16} color={colors.text3} />
                <Text variant="caption" tone="tertiary" weight="600">
                  {t("common.remove")}
                </Text>
              </PressableScale>
            ) : null}
          </View>
          <TextField label={t("kyc.details.firstName")} value={p.first_name} onChangeText={(v) => upd(i, { first_name: v })} accessibilityLabel={t("kyc.parties.firstNameAria", { n: i + 1 })} />
          <TextField label={t("kyc.details.lastName")} value={p.last_name} onChangeText={(v) => upd(i, { last_name: v })} accessibilityLabel={t("kyc.parties.lastNameAria", { n: i + 1 })} />
          <DateField label={t("kyc.details.dob")} value={p.date_of_birth} onChange={(v) => upd(i, { date_of_birth: v })} accessibilityLabel={t("kyc.parties.dobAria", { n: i + 1 })} />
          <CountryField label={t("kyc.parties.nationality")} value={p.nationality} onChange={(v) => upd(i, { nationality: v })} />
          <Text variant="label" tone="tertiary">
            {t("mobileProfile.kyc.people.idType")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {ID_TYPES.map((o) => (
              <Pill key={o.value} label={t(o.label)} selected={p.id_type === o.value} onPress={() => upd(i, { id_type: o.value })} compact />
            ))}
          </View>
          <OwnershipField label={t("kyc.parties.ownership")} value={p.ownership} onChange={(v) => upd(i, { ownership: v })} accessibilityLabel={t("kyc.parties.ownershipAria", { n: i + 1 })} error={uboBad(p) ? t("mobileProfile.kyc.people.uboOwnership") : undefined} />
          <Text variant="label" tone="tertiary">
            {t("mobileProfile.kyc.people.roles")}
          </Text>
          {(["director", "ubo"] as const).map((r) => (
            <Checkbox key={r} checked={p.roles.includes(r)} onChange={() => toggleRole(i, r)}>
              <Text variant="callout">{r === "director" ? t("kyc.parties.director") : t("kyc.parties.uboCheckbox")}</Text>
            </Checkbox>
          ))}
        </View>
      ))}
      <FormError message={err?.message} />
      {list.length < 10 ? <Button label={t("kyc.parties.addPerson")} variant="secondary" icon={<Plus size={18} color={colors.text} />} onPress={() => setList((l) => [...l, { ...EMPTY_PARTY }])} /> : null}
      <StepNav onBack={onBack} busy={busy} disabled={!ready} onNext={() => void run({ parties: list.map((p) => ({ ...p, first_name: p.first_name.trim(), last_name: p.last_name.trim() })) }, onSaved)} />
    </Pad>
  );
}

function CorpDocsStep({ state, onSaved, onBack, onNext }: { state: KycState; onSaved: (s: KycState) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const parties = state.case?.details.parties ?? [];
  const inc: Slot = { kind: "incorporation", side: "single" };
  const addr: Slot = { kind: "company_address", side: "single" };
  const ready = state.required.filter((r) => r.kind !== "selfie").every((r) => r.uploaded);
  return (
    <Pad>
      <StepTitle title={t("kyc.corpDocs.title")} text={t("kyc.corpDocs.text")} />
      <DocSlot slot={inc} label={t("kyc.corpDocs.incorporation")} hint={t("kyc.corpDocs.incorporationHint")} purpose="doc" aspect={ASPECT.a4} doc={docFor(state, inc)} onUploaded={onSaved} />
      <PoaSlot slot={addr} label={t("kyc.corpDocs.companyPoa")} doc={docFor(state, addr)} onUploaded={onSaved} company />
      {parties.map((p) => {
        const passport = p.id_type === "passport";
        const idType = ID_TYPES.find((o) => o.value === p.id_type);
        const idLabel = idType ? t(idType.label) : "";
        const f: Slot = { kind: "party_id", side: "front", party: p.key };
        const b: Slot = { kind: "party_id", side: "back", party: p.key };
        return (
          <View key={p.key} style={{ gap: space[3], marginTop: space[2] }}>
            <Text variant="headline" weight="700">
              {p.first_name} {p.last_name}
              <Text tone="tertiary"> · {p.roles.map((r) => (r === "ubo" ? t("kyc.parties.ubo") : t("kyc.parties.director"))).join(", ")}</Text>
            </Text>
            <DocSlot slot={f} label={passport ? t("kyc.id.passportPage") : t("kyc.corpDocs.idFront")} hint={idLabel} purpose="id" aspect={passport ? ASPECT.passport : ASPECT.card} passport={passport} doc={docFor(state, f)} onUploaded={onSaved} />
            {!passport ? <DocSlot slot={b} label={t("kyc.corpDocs.idBack")} hint={idLabel} purpose="id" doc={docFor(state, b)} onUploaded={onSaved} /> : null}
          </View>
        );
      })}
      <StepNav onBack={onBack} onNext={onNext} disabled={!ready} />
    </Pad>
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

export function Wizard({ state, onSubmitted, onStep }: { state: KycState; onSubmitted: (s: KycState) => void; onStep?: () => void }) {
  const t = useT();
  const corporate = state.case!.kind === "corporate";
  const steps = corporate
    ? [t("kyc.steps.company"), t("kyc.steps.people"), t("kyc.steps.documents"), t("kyc.steps.selfie"), t("kyc.steps.review")]
    : [t("kyc.steps.yourDetails"), t("kyc.steps.identityDocument"), t("kyc.steps.proofOfAddress"), t("kyc.steps.selfie"), t("kyc.steps.review")];
  const [step, setStepRaw] = React.useState(() => firstIncomplete(state));
  const [consent, setConsent] = React.useState(false);
  const [phase, setPhase] = React.useState<"form" | "checking">("form");
  const [result, setResult] = React.useState<KycState | null>(null);
  const [checkSteps, setCheckSteps] = React.useState(() => submissionChecks(state, t));
  const [err, setErr] = React.useState<string | null>(null);
  const setStep = (n: number) => {
    setStepRaw(n);
    onStep?.();
  };
  const saved = (next: number | null) => (s: KycState) => {
    applyKyc(s);
    if (next !== null) setStep(next);
  };
  const poa: Slot = { kind: "proof_of_address", side: "single" };

  async function submit() {
    setErr(null);
    setCheckSteps(submissionChecks(state, t));
    setPhase("checking");
    onStep?.();
    setResult(null);
    const r = await kycPost("submit", { confirm: true });
    if (!r.ok) {
      setPhase("form");
      return setErr(r.error.message);
    }
    setResult(r.data);
  }
  const finish = React.useCallback(() => {
    if (result) onSubmitted(result);
  }, [result, onSubmitted]);

  if (phase === "checking") return <CheckingSequence steps={checkSteps} serverDone={!!result} onFinish={finish} />;

  const address = state.case?.details.address;
  return (
    <View style={{ gap: space[5] }}>
      <Stepper steps={steps} current={step} />
      <Animated.View key={step} entering={FadeIn.duration(160)}>
        {corporate ? (
          step === 0 ? (
            <CompanyStep state={state} onSaved={saved(1)} />
          ) : step === 1 ? (
            <PeopleStep state={state} onSaved={saved(2)} onBack={() => setStep(0)} />
          ) : step === 2 ? (
            <CorpDocsStep state={state} onSaved={saved(null)} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          ) : step === 3 ? (
            <SelfieStep state={state} onSaved={saved(null)} onBack={() => setStep(2)} onNext={() => setStep(4)} />
          ) : null
        ) : step === 0 ? (
          <DetailsStep state={state} onSaved={saved(1)} />
        ) : step === 1 ? (
          <IdStep state={state} onSaved={saved(null)} onBack={() => setStep(0)} onNext={() => setStep(2)} />
        ) : step === 2 ? (
          <Pad>
            <StepTitle title={t("kyc.poa.title")} text={t("kyc.poa.text")} />
            {address ? <Note icon={UserRound}>{t("kyc.poa.addressOnFile", { address: [address.line1, address.line2, address.city, address.postcode, countryName(address.country)].filter(Boolean).join(", ") })}</Note> : null}
            <PoaSlot slot={poa} label={t("kyc.poa.title")} doc={docFor(state, poa)} onUploaded={saved(null)} />
            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={!docFor(state, poa)} />
          </Pad>
        ) : step === 3 ? (
          <SelfieStep state={state} onSaved={saved(null)} onBack={() => setStep(2)} onNext={() => setStep(4)} />
        ) : null}
        {step === 4 ? (
          <Pad>
            <StepTitle title={t("kyc.review.title")} text={t("kyc.review.text")} />
            <ReviewList state={state} />
            <Consent checked={consent} onChange={setConsent} />
            <FormError message={err} />
            <StepNav onBack={() => setStep(3)} onNext={() => void submit()} nextLabel={t("kyc.wizard.submitForVerification")} disabled={!consent || state.required.some((r) => !r.uploaded)} testID="kyc-submit" />
          </Pad>
        ) : null}
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* More information requested                                           */
/* ------------------------------------------------------------------ */

export function MoreInfo({ state, onSubmitted }: { state: KycState; onSubmitted: (s: KycState) => void }) {
  const t = useT();
  const c = state.case!;
  const [phase, setPhase] = React.useState<"form" | "checking">("form");
  const [result, setResult] = React.useState<KycState | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const requested = state.required.filter((r) => r.requested);
  const ready = requested.every((r) => r.uploaded);
  const parties = c.details.parties ?? [];
  const onSaved = (s: KycState) => applyKyc(s);

  async function submit() {
    setErr(null);
    setPhase("checking");
    const r = await kycPost("submit", { confirm: true });
    if (!r.ok) {
      setPhase("form");
      return setErr(r.error.message);
    }
    setResult(r.data);
  }
  const finish = React.useCallback(() => {
    if (result) onSubmitted(result);
  }, [result, onSubmitted]);

  if (phase === "checking")
    return <CheckingSequence steps={submissionChecks(state, t).filter((s) => ["received", "quality", "resolution", "poa", "face", "send"].includes(s.key))} serverDone={!!result} onFinish={finish} />;

  return (
    <Pad>
      <View style={{ padding: space[4], borderRadius: radius.lg, backgroundColor: tint.gold, borderWidth: 1, borderColor: tint.goldLine, gap: space[2] }} testID="kyc-more-info">
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <AlertTriangle size={18} color={colors.gold} />
          <Text variant="headline" weight="700" style={{ flex: 1 }}>
            {t("kyc.moreInfo.title")}
          </Text>
        </View>
        <Text variant="callout" tone="secondary">
          {t("kyc.moreInfo.text")}
        </Text>
        {c.request_message ? (
          <View style={{ marginTop: space[1], padding: space[3], borderRadius: radius.sm, backgroundColor: colors.surface, borderStartWidth: 3, borderStartColor: colors.gold, gap: 2 }}>
            <Text variant="label" tone="tertiary">
              {t("kyc.wizard.noteFromTeam")}
            </Text>
            <Text variant="callout">{c.request_message}</Text>
          </View>
        ) : null}
      </View>
      {requested.map((r) => {
        const doc = docFor(state, r);
        const party = parties.find((p) => p.key === r.party);
        if (r.kind === "proof_of_address" || r.kind === "company_address") return <PoaSlot key={r.label} slot={r} label={r.label} doc={doc} requested onUploaded={onSaved} company={r.kind === "company_address"} />;
        const passport = r.kind === "id_document" ? c.id_doc_type === "passport" : r.kind === "party_id" ? party?.id_type === "passport" : false;
        const purpose = r.kind === "selfie" ? "selfie" : r.kind === "incorporation" ? "doc" : "id";
        return (
          <DocSlot
            key={r.label}
            slot={r}
            label={r.label}
            hint={r.kind === "selfie" ? t("kyc.selfie.hint") : t("kyc.moreInfo.docHint")}
            purpose={purpose}
            aspect={purpose === "doc" ? ASPECT.a4 : purpose === "selfie" ? 3 / 4 : passport ? ASPECT.passport : ASPECT.card}
            passport={passport}
            doc={doc}
            requested
            onUploaded={onSaved}
          />
        );
      })}
      <Consent checked={consent} onChange={setConsent} />
      <FormError message={err} />
      <Button label={t("kyc.moreInfo.send")} disabled={!ready || !consent} onPress={() => void submit()} trailing={<NextArrow />} testID="kyc-resubmit" />
    </Pad>
  );
}

