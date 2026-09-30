// One document position (ID front, proof of address, selfie…): guided camera, photo library or a file -> instant
// checks -> "Use this photo" -> encrypted upload with progress -> received. Same states and rules as the Client
// Area's DocSlot; a failed check (resolution, a too-old issue date) blocks the upload, warnings don't.
import * as React from "react";
import { useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { AlertTriangle, Camera, Check, CircleCheck, FileText, Image as ImageIcon, Info, Upload, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { onSignOut } from "@/session";
import { Button, PressableScale, Skeleton, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import { StatusChip } from "../components/bits";
import { OK, tint } from "../tint";
import { CaptureModal } from "./CaptureModal";
import { checkRows, type CheckRow } from "./checks";
import { pickFile, pickPhoto, prepare, uploadDocument, type Picked } from "./files";
import { ASPECT, MIN_SIDE, slotKey, type ClientChecks, type KycDocument, type KycState, type Purpose, type Slot } from "./types";

/** What the client captured in this app session (never uploaded anywhere else). Forgotten on sign-out, so the
 *  next person to sign in on this phone never sees the previous client's documents. */
const previews = new Map<string, { uri: string; mime: string }>();
export const previewFor = (slot: Slot) => previews.get(slotKey(slot));
onSignOut(() => previews.clear());

type Mode = "idle" | "checking" | "review" | "uploading" | "done";

const ROW_ICON: Record<CheckRow["state"], { icon: typeof Check; color: string }> = {
  ok: { icon: CircleCheck, color: OK },
  warn: { icon: AlertTriangle, color: colors.gold },
  fail: { icon: X, color: colors.ember },
  info: { icon: Info, color: colors.periwinkle },
};

export function CheckList({ rows }: { rows: CheckRow[] }) {
  const t = useT();
  return (
    <View style={{ gap: space[2] }} accessibilityLabel={t("kyc.check.listAria")}>
      {rows.map((r) => {
        const I = ROW_ICON[r.state];
        return (
          <View key={r.key} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }} testID={`check-${r.key}`}>
            <I.icon size={16} color={I.color} style={{ marginTop: 2 }} />
            <Text variant="caption" style={{ flex: 1, lineHeight: 18 }}>
              <Text variant="caption" weight="700">
                {r.label}
              </Text>
              <Text variant="caption" tone={r.state === "fail" ? "ember" : r.state === "warn" ? "gold" : "tertiary"}>
                {"  "}
                {r.detail}
              </Text>
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Progress({ pct }: { pct: number }) {
  const w = useSharedValue(0);
  React.useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, pct)), { duration: 180 });
  }, [pct, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: "hidden" }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: colors.ember }, bar]} />
    </View>
  );
}

function Preview({ uri, mime, aspect, round, small }: { uri?: string; mime?: string; aspect: number; round?: boolean; small?: boolean }) {
  const image = !!uri && !!mime && mime.startsWith("image/") && !/hei[cf]/i.test(mime);
  if (small)
    return image ? (
      <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: round ? 28 : radius.sm, backgroundColor: colors.surface3 }} contentFit="cover" transition={0} />
    ) : (
      <View style={{ width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" }}>
        <FileText size={22} color={colors.text3} />
      </View>
    );
  return image ? (
    <Image source={{ uri }} style={{ width: "100%", aspectRatio: round ? 3 / 4 : Math.max(0.7, aspect), borderRadius: radius.md, backgroundColor: colors.bg }} contentFit="contain" transition={0} accessibilityLabel="" />
  ) : (
    <View style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center", gap: space[2] }}>
      <FileText size={40} color={colors.text3} />
    </View>
  );
}

function Tile({ icon: Icon, title, hint, onPress, primary, stacked, testID }: { icon: typeof Camera; title: string; hint?: string; onPress: () => void; primary?: boolean; stacked?: boolean; testID?: string }) {
  return (
    <PressableScale
      onPress={onPress}
      testID={testID}
      scaleTo={0.97}
      accessibilityLabel={hint ? `${title}. ${hint}` : title}
      style={{
        ...(stacked ? { alignSelf: "stretch" as const } : { flex: 1 }),
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        borderRadius: radius.md,
        backgroundColor: primary ? tint.ember : colors.surface2,
        borderWidth: 1,
        borderColor: primary ? tint.emberLine : colors.line,
      }}
    >
      <Icon size={20} color={primary ? colors.ember : colors.text2} />
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="700" numberOfLines={2}>
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

export type DocSlotProps = {
  slot: Slot;
  label: string;
  hint: string;
  purpose: Purpose;
  aspect?: number;
  passport?: boolean;
  doc?: KycDocument | null;
  requested?: boolean;
  issueDate?: string;
  docType?: string;
  /** why the slot can't be used yet (e.g. "Enter the issue date first") */
  blocked?: string | null;
  onUploaded: (s: KycState) => void;
};

export function DocSlot({ slot, label, hint, purpose, aspect = ASPECT.card, passport, doc, requested, issueDate, docType, blocked, onUploaded }: DocSlotProps) {
  const t = useT();
  const current = doc && (doc.status === "uploaded" || doc.status === "accepted") ? doc : null;
  const [mode, setMode] = React.useState<Mode>(current ? "done" : "idle");
  const [cap, setCap] = React.useState<{ file: Picked; checks: ClientChecks } | null>(null);
  const [pct, setPct] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [camera, setCamera] = React.useState(false);
  const local = previewFor(slot);
  const selfie = purpose === "selfie";
  const testId = slotKey(slot).replace(/:/g, "-");
  // two tiles side by side leave too little room for their labels on a 360 pt phone: stack them there (a lone
  // tile, or a stacked one, sizes to its content: `flex: 1` in a column of unknown height would collapse on native)
  const narrow = useWindowDimensions().width < 380 && !selfie;

  React.useEffect(() => {
    if (current && mode === "idle") setMode("done");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const fail = (m: string) => {
    setMsg(m);
    setMode(current ? "done" : "idle");
  };

  const accept = async (p: Picked | null | "denied") => {
    if (!p) return;
    if (p === "denied") return fail(t("mobileProfile.camera.deniedBody"));
    setMsg(null);
    setMode("checking");
    const r = await prepare(p, purpose, { passport, issueDate });
    if ("error" in r) {
      const m = r.error === "tooLarge" ? t("mobileProfile.slot.fileTooLarge") : r.error === "tooSmall" ? t("mobileProfile.slot.fileTooSmall") : r.error === "selfiePhoto" ? t("kyc.slot.error.selfiePhoto") : t("kyc.slot.error.format");
      return fail(m);
    }
    setCap(r);
    setMode("review");
  };

  const send = async () => {
    if (!cap) return;
    setMode("uploading");
    setPct(0);
    const r = await uploadDocument(slot, cap.file, { checks: cap.checks, issueDate, docType, onProgress: setPct });
    if (!r.ok) {
      setMsg(r.error.message);
      setMode("review");
      return;
    }
    previews.set(slotKey(slot), { uri: cap.file.uri, mime: cap.file.mime });
    setCap(null);
    setMode("done");
    onUploaded(r.data.state);
  };

  const rows = cap ? checkRows(cap.checks, purpose, { passport }) : [];
  const hardFail = rows.some((r) => r.state === "fail");
  const warns = rows.filter((r) => r.state === "warn").length;
  const border = mode === "done" ? tint.okLine : requested ? tint.goldLine : colors.line;

  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: border, backgroundColor: colors.surface, padding: space[4], gap: space[3] }} testID={`slot-${testId}`}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" weight="700">
            {label}
          </Text>
          <Text variant="caption" tone="tertiary">
            {hint}
          </Text>
        </View>
        {mode === "done" ? <StatusChip label={t("kyc.slot.uploaded")} tone="ok" /> : requested ? <StatusChip label={t("kyc.slot.requested")} tone="gold" /> : null}
      </View>

      {msg ? (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start", padding: space[3], borderRadius: radius.sm, backgroundColor: tint.ember, borderWidth: 1, borderColor: tint.emberLine }}>
          <AlertTriangle size={16} color={colors.ember} style={{ marginTop: 1 }} />
          <Text variant="caption" style={{ flex: 1 }}>
            {msg}
          </Text>
        </View>
      ) : null}

      {mode === "checking" ? (
        <View style={{ gap: space[3] }}>
          <Skeleton h={180} r={radius.md} />
          <Text variant="callout" tone="tertiary">
            {t("mobileProfile.slot.checking")}
          </Text>
        </View>
      ) : (mode === "review" || mode === "uploading") && cap ? (
        <View style={{ gap: space[4] }}>
          <Preview uri={cap.file.uri} mime={cap.file.mime} aspect={aspect} round={selfie} />
          <CheckList rows={rows} />
          {mode === "uploading" ? (
            <View style={{ gap: space[2] }} accessibilityLiveRegion="polite">
              <Progress pct={pct} />
              <Text variant="caption" tone="tertiary">
                {t("mobileProfile.slot.uploadingPct", { pct })}
              </Text>
            </View>
          ) : (
            <View style={{ gap: space[2] }}>
              <Button label={warns ? t("kyc.slot.useAnyway") : selfie ? t("kyc.slot.useSelfie") : t("kyc.slot.usePhoto")} icon={<Check size={18} color={colors.ink} />} disabled={hardFail} onPress={() => void send()} testID={`use-${testId}`} />
              <Button
                label={cap.file.origin === "camera" ? t("kyc.slot.retake") : t("kyc.slot.chooseAnother")}
                variant="secondary"
                onPress={() => {
                  setCap(null);
                  setMsg(null);
                  if (cap.file.origin === "camera") setCamera(true);
                  else setMode(current ? "done" : "idle");
                }}
              />
              {warns > 0 ? (
                <Text variant="caption" tone="tertiary">
                  {t("kyc.slot.clearerFaster")}
                </Text>
              ) : null}
            </View>
          )}
        </View>
      ) : mode === "done" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <Preview uri={local?.uri} mime={local?.mime ?? current?.mime} aspect={aspect} round={selfie} small />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CircleCheck size={16} color={OK} />
              <Text variant="callout" weight="700" color={OK}>
                {t("kyc.slot.received")}
              </Text>
            </View>
            {current ? (
              <Text variant="caption" tone="tertiary">
                {current.checks?.resolution?.width ? `${current.checks.resolution.width} × ${current.checks.resolution.height} px · ` : ""}
                {`${(current.size_bytes / 1024 / 1024).toFixed(2)} MB`}
              </Text>
            ) : null}
          </View>
          {!blocked ? <Button label={t("kyc.slot.replace")} variant="ghost" size="sm" full={false} onPress={() => setMode("idle")} style={{ alignSelf: "center" }} /> : null}
        </View>
      ) : blocked ? (
        <View style={{ borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.lineStrong, paddingVertical: space[5], paddingHorizontal: space[4] }}>
          <Text variant="caption" tone="tertiary" align="center">
            {blocked}
          </Text>
        </View>
      ) : (
        <View style={{ gap: space[2] }}>
          <Tile icon={Camera} stacked title={selfie ? t("mobileProfile.slot.takeSelfie") : t("mobileProfile.slot.takePhoto")} hint={t("mobileProfile.slot.guided")} primary={purpose !== "poa" && purpose !== "doc"} onPress={() => setCamera(true)} testID={`camera-${testId}`} />
          <View style={{ flexDirection: narrow ? "column" : "row", gap: space[2] }}>
            <Tile icon={ImageIcon} title={t("mobileProfile.slot.choosePhoto")} stacked={narrow} onPress={() => void pickPhoto(purpose).then(accept).catch(() => fail(t("mobileProfile.slot.pickFailed")))} testID={`photos-${testId}`} />
            {!selfie ? <Tile icon={Upload} title={t("mobileProfile.slot.chooseFile")} stacked={narrow} primary={purpose === "poa" || purpose === "doc"} onPress={() => void pickFile(purpose).then(accept).catch(() => fail(t("mobileProfile.slot.pickFailed")))} testID={`file-${testId}`} /> : null}
          </View>
          <Text variant="caption" tone="tertiary">
            {selfie ? t("kyc.slot.formatsSelfie") : t("mobileProfile.slot.chooseFileHint")} · {t("kyc.slot.minSide", { min: MIN_SIDE[purpose] })}
          </Text>
          {current ? <Button label={t("common.cancel")} variant="ghost" size="sm" onPress={() => setMode("done")} /> : null}
        </View>
      )}

      <CaptureModal
        visible={camera}
        purpose={purpose}
        aspect={aspect}
        passport={passport}
        title={label}
        onClose={() => setCamera(false)}
        onCaptured={(p) => {
          setCamera(false);
          void accept(p);
        }}
        onFallback={() => void pickPhoto(purpose).then(accept).catch(() => fail(t("mobileProfile.slot.pickFailed")))}
      />
    </View>
  );
}
