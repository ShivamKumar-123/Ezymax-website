"use client";

import * as React from "react";
import { Camera, CheckCircle2, Clock, FileText, IdCard, Lock, ScanFace, Upload, Home, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Chip, Icon3D, PageHeader, Progress, Reveal, Segmented, Stepper, cn } from "@/components/kit";
import { IS_DEMO } from "@kalks/mock";
import { useT } from "@kalks/i18n/react";
import { LiveVerification } from "@/components/verification/live-verification";

// name / unlocks are message keys, translated at render
const LEVELS = [
  { level: 0, name: "kyc.levels.registered", unlocks: ["kyc.levels.unlock.demoAccounts", "kyc.levels.unlock.platformTools"], done: true },
  { level: 1, name: "kyc.levels.contactVerified", unlocks: ["kyc.levels.unlock.liveAccounts", "kyc.levels.unlock.deposits", "kyc.levels.unlock.copyPamm"], done: true },
  { level: 2, name: "kyc.levels.identityVerified", unlocks: ["kyc.levels.unlock.withdrawals", "kyc.levels.unlock.partnerPayouts", "kyc.levels.unlock.higherLimits", "kyc.levels.unlock.becomeMaster"], done: false },
] as const;

function UploadBox({ label, hint, done, onDone }: { label: string; hint: string; done?: boolean; onDone: () => void }) {
  const tt = useT();
  const [state, setState] = React.useState<"idle" | "uploading" | "done">(done ? "done" : "idle");
  const [pct, setPct] = React.useState(0);
  function start() {
    setState("uploading");
    let p = 0;
    const t = setInterval(() => {
      p += 12;
      setPct(Math.min(100, p));
      if (p >= 100) {
        clearInterval(t);
        setState("done");
        onDone();
      }
    }, 120);
  }
  return (
    <button
      type="button"
      onClick={state === "idle" ? start : undefined}
      className={cn(
        "flex min-h-40 w-full flex-col items-center justify-center rounded-[18px] border-2 border-dashed p-5 text-center transition-colors",
        state === "done" ? "border-up/40 bg-up-soft" : "border-line bg-surface-2 hover:border-ember/50",
      )}
    >
      {state === "done" ? (
        <>
          <CheckCircle2 className="size-8 text-up" />
          <div className="mt-2 text-sm font-medium">{tt("kyc.demo.fileUploaded", { label })}</div>
          <div className="text-xs text-fg-3">{tt("kyc.demo.looksSharp")}</div>
        </>
      ) : state === "uploading" ? (
        <div className="w-full max-w-[200px]">
          <div className="mb-2 text-sm">{tt("kyc.demo.uploading")}</div>
          <Progress value={pct} />
        </div>
      ) : (
        <>
          <Upload className="size-7 text-fg-3" />
          <div className="mt-2 text-sm font-medium">{label}</div>
          <div className="mt-0.5 text-xs text-fg-3">{hint}</div>
        </>
      )}
    </button>
  );
}

function DemoVerificationPage() {
  const t = useT();
  const [step, setStep] = React.useState(0);
  const [doc, setDoc] = React.useState<"passport" | "id" | "license">("passport");
  const [uploaded, setUploaded] = React.useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = React.useState(false);

  return (
    <div>
      <PageHeader title={t("kyc.page.title")} subtitle={t("kyc.page.subtitleDemo")} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Reveal className="xl:col-span-1">
          <Card className="h-full">
            <CardHeader title={t("kyc.levels.title")} icon={<ShieldCheck />} />
            <div className="space-y-3 p-6 pt-4">
              {LEVELS.map((l) => (
                <div key={l.level} className={cn("k-row p-4", !l.done && "border-ember/40 bg-ember-soft/40")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn("grid size-8 place-items-center rounded-full text-xs font-semibold", l.done ? "bg-up-soft text-up" : "bg-ember text-white")}>{l.done ? <Check className="size-4" strokeWidth={2.5} /> : l.level}</span>
                      <div>
                        <div className="text-sm font-medium">{t("kyc.levels.level", { n: l.level })}</div>
                        <div className="text-xs text-fg-3">{t(l.name)}</div>
                      </div>
                    </div>
                    {l.done ? <Chip size="sm" tone="up">{t("kyc.levels.complete")}</Chip> : <Chip size="sm" tone="warn" dot>{t("kyc.levels.inReview")}</Chip>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {l.unlocks.map((u) => (
                      <span key={u} className="flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">
                        {!l.done && <Lock className="size-2.5" />}
                        {t(u)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="px-1 pt-2 text-xs leading-relaxed text-fg-3">
                {t("kyc.levels.privacyDemo")}
              </p>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="xl:col-span-2">
          <Card className="h-full">
            <div className="p-6">
              <Stepper steps={[t("kyc.demo.stepIdentity"), t("kyc.demo.stepPoa"), t("kyc.demo.stepSelfie"), t("kyc.demo.stepReview")]} current={submitted ? 4 : step} />
            </div>
            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-10 text-center">
                    <Icon3D name="hourglass_not_done" size={88} />
                    <h3 className="mt-4 text-xl font-medium">{t("kyc.demo.submittedTitle")}</h3>
                    <p className="mt-2 max-w-md text-sm text-fg-2">{t("kyc.demo.submittedText")}</p>
                    <div className="mt-6 flex items-center gap-2 text-sm text-fg-3">
                      <Clock className="size-4" /> {t("kyc.demo.submittedMeta", { ref: "KYC-88142" })}
                    </div>
                  </motion.div>
                ) : step === 0 ? (
                  <motion.div key="s0" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-medium">{t("kyc.demo.idTitle")}</h3>
                        <p className="text-sm text-fg-3">{t("kyc.demo.idText", { country: "India" })}</p>
                      </div>
                      <Segmented value={doc} onChange={setDoc} options={[{ value: "passport", label: t("kyc.idType.passport") }, { value: "id", label: t("kyc.idType.nationalId") }, { value: "license", label: t("kyc.idType.drivingLicence") }]} />
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <UploadBox label={doc === "passport" ? t("kyc.demo.photoPage") : t("kyc.demo.frontSide")} hint={t("kyc.demo.fileHint")} onDone={() => setUploaded((u) => ({ ...u, front: true }))} />
                      {doc !== "passport" ? <UploadBox label={t("kyc.demo.backSide")} hint={t("kyc.demo.fileHint")} onDone={() => setUploaded((u) => ({ ...u, back: true }))} /> : (
                        <div className="flex min-h-40 items-center gap-4 rounded-[18px] border border-line bg-surface-2 p-5">
                          <Icon3D name="identification_card" size={64} />
                          <ul className="space-y-1.5 text-[13px] text-fg-2">
                            <li className="flex items-center gap-2"><Check className="size-3.5 text-up" /> {t("kyc.demo.tipCorners")}</li>
                            <li className="flex items-center gap-2"><Check className="size-3.5 text-up" /> {t("kyc.demo.tipGlare")}</li>
                            <li className="flex items-center gap-2"><Check className="size-3.5 text-up" /> {t("kyc.demo.tipExpired")}</li>
                          </ul>
                        </div>
                      )}
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button variant="ember" disabled={!uploaded.front} onClick={() => setStep(1)}>
                        {t("common.continue")} <ArrowRight className="rtl:-scale-x-100" />
                      </Button>
                    </div>
                  </motion.div>
                ) : step === 1 ? (
                  <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <h3 className="text-lg font-medium">{t("kyc.demo.poaTitle")}</h3>
                    <p className="text-sm text-fg-3">{t("kyc.demo.poaText")}</p>
                    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr]">
                      <UploadBox label={t("kyc.demo.addressDoc")} hint={t("kyc.demo.addressDocHint")} onDone={() => setUploaded((u) => ({ ...u, poa: true }))} />
                      <div className="k-row space-y-2 p-5 text-[13px] text-fg-2">
                        <div className="flex items-center gap-2 font-medium text-fg">
                          <Home className="size-4" /> {t("kyc.demo.addressOnFile")}
                        </div>
                        <p>1204, Lodha Altamount, Altamount Road, Mumbai 400026, India</p>
                        <p className="text-fg-3">{t("kyc.demo.addressMustMatch")}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(0)}>
                        {t("common.back")}
                      </Button>
                      <Button variant="ember" disabled={!uploaded.poa} onClick={() => setStep(2)}>
                        {t("common.continue")} <ArrowRight className="rtl:-scale-x-100" />
                      </Button>
                    </div>
                  </motion.div>
                ) : step === 2 ? (
                  <motion.div key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <h3 className="text-lg font-medium">{t("kyc.demo.selfieTitle")}</h3>
                    <p className="text-sm text-fg-3">{t("kyc.demo.selfieText")}</p>
                    <div className="mt-5 grid grid-cols-1 items-center gap-6 md:grid-cols-2">
                      <div className="relative mx-auto grid aspect-square w-full max-w-[280px] place-items-center overflow-hidden rounded-full border border-line bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/people/men-32.jpg" alt="" className={cn("size-full object-cover transition-opacity", uploaded.selfie ? "opacity-100" : "opacity-25 blur-[2px]")} />
                        <div className="absolute inset-4 rounded-full border-2 border-dashed border-ember/60" />
                        {!uploaded.selfie && <ScanFace className="absolute size-14 text-ember" />}
                        {uploaded.selfie && <CheckCircle2 className="absolute bottom-6 end-10 size-10 rounded-full bg-bg text-up" />}
                      </div>
                      <div className="space-y-3">
                        {([t("kyc.demo.live.straight"), t("kyc.demo.live.left"), t("kyc.demo.live.right"), t("kyc.demo.live.smile")]).map((s, i) => (
                          <div key={s} className="k-row flex items-center gap-3 px-4 py-3 text-sm">
                            <span className={cn("grid size-6 place-items-center rounded-full text-xs", uploaded.selfie ? "bg-up-soft text-up" : "bg-surface-3 text-fg-3")}>{uploaded.selfie ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}</span>
                            {s}
                          </div>
                        ))}
                        <Button variant="ember" className="w-full" onClick={() => { setUploaded((u) => ({ ...u, selfie: true })); toast.success(t("kyc.demo.livenessPassed")); }}>
                          <Camera /> {uploaded.selfie ? t("kyc.demo.retake") : t("kyc.demo.startCamera")}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-6 flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(1)}>
                        {t("common.back")}
                      </Button>
                      <Button variant="ember" disabled={!uploaded.selfie} onClick={() => setStep(3)}>
                        {t("common.continue")} <ArrowRight className="rtl:-scale-x-100" />
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="s3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <h3 className="text-lg font-medium">{t("kyc.demo.reviewTitle")}</h3>
                    <div className="mt-4 space-y-2">
                      {[
                        [IdCard, doc === "passport" ? t("kyc.idType.passport") : doc === "id" ? t("kyc.idType.nationalId") : t("kyc.idType.drivingLicence"), t("kyc.demo.uploaded")],
                        [FileText, t("kyc.demo.poaTitle"), t("kyc.demo.uploaded")],
                        [ScanFace, t("kyc.demo.selfieLiveness"), t("kyc.demo.passed")],
                      ].map(([Ic, k, v]) => {
                        const I = Ic as typeof IdCard;
                        return (
                          <div key={k as string} className="k-row flex items-center gap-3 px-4 py-3">
                            <I className="size-5 text-fg-2" />
                            <span className="flex-1 text-sm">{k as string}</span>
                            <Chip tone="up" size="sm">
                              {v as string}
                            </Chip>
                          </div>
                        );
                      })}
                    </div>
                    <label className="mt-5 flex items-start gap-3 text-[13px] text-fg-2">
                      <input type="checkbox" defaultChecked className="mt-0.5 size-4 accent-[var(--k-ember)]" />
                      {t("kyc.demo.consent")}
                    </label>
                    <div className="mt-6 flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(2)}>
                        {t("common.back")}
                      </Button>
                      <Button variant="ember" shimmer onClick={() => { setSubmitted(true); toast.success(t("kyc.demo.toastSubmitted")); }}>
                        {t("kyc.wizard.submitForVerification")}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

/** Live builds: the real KYC flow (gateway /v1/kyc via /api/kyc). Demo builds keep the showcase above. */
export default function VerificationPage() {
  return IS_DEMO ? <DemoVerificationPage /> : <LiveVerification />;
}
