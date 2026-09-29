// Guided camera for identity documents and the selfie: a full-screen camera with the document's outline (ID card,
// passport page, A4 letter) or the face oval, the guidance line, a torch for documents and one big shutter.
// The part of the photo inside the outline is what the instant checks look at (the whole photo is uploaded).
import * as React from "react";
import { Linking, Modal, Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Defs, Ellipse, Mask, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera as CameraIcon, Flashlight, FlashlightOff, X } from "lucide-react-native";
import { useT } from "@/i18n";
import { haptic } from "@/lib/haptics";
import { Button, Display, IconButton, PressableScale, Text } from "@/ui";
import { colors, radius, space } from "@/theme/tokens";
import type { Picked } from "./files";
import type { Crop } from "./pixels";
import type { Purpose } from "./types";

type Frame = { x: number; y: number; w: number; h: number };

/** Where the outline sits on screen (view points). */
function frameFor(vw: number, vh: number, purpose: Purpose, aspect: number): Frame {
  const cy = vh * 0.43;
  if (purpose === "selfie") {
    const w = vw * 0.68;
    const h = Math.min(w * 1.34, vh * 0.52);
    return { x: (vw - w) / 2, y: cy - h / 2, w, h };
  }
  let w = vw * 0.86;
  let h = w / aspect;
  const maxH = vh * 0.56;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { x: (vw - w) / 2, y: cy - h / 2, w, h };
}

/** The outline in the photo's own coordinates (normalised), assuming the preview fills the view (aspect fill). */
function cropFor(f: Frame, vw: number, vh: number, pw: number, ph: number, margin = 0.05): Crop {
  const scale = Math.max(vw / pw, vh / ph);
  const offX = (pw * scale - vw) / 2;
  const offY = (ph * scale - vh) / 2;
  const mx = f.w * margin;
  const my = f.h * margin;
  const x0 = Math.max(0, (f.x - mx + offX) / scale / pw);
  const y0 = Math.max(0, (f.y - my + offY) / scale / ph);
  const x1 = Math.min(1, (f.x + f.w + mx + offX) / scale / pw);
  const y1 = Math.min(1, (f.y + f.h + my + offY) / scale / ph);
  if (x1 - x0 < 0.2 || y1 - y0 < 0.2) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function CaptureModal({
  visible,
  purpose,
  aspect,
  passport,
  title,
  onClose,
  onCaptured,
  onFallback,
}: {
  visible: boolean;
  purpose: Purpose;
  aspect: number;
  passport?: boolean;
  title: string;
  onClose: () => void;
  onCaptured: (p: Picked) => void;
  /** choose a photo instead (camera refused or unavailable) */
  onFallback: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width: vw, height: vh } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = React.useRef<CameraView>(null);
  const [ready, setReady] = React.useState(false);
  const [torch, setTorch] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const selfie = purpose === "selfie";
  const f = frameFor(vw, vh, purpose, aspect);

  React.useEffect(() => {
    if (!visible) {
      setReady(false);
      setTorch(false);
      setBusy(false);
      setFailed(false);
    }
  }, [visible]);

  const capture = async () => {
    if (!cam.current || !ready || busy) return;
    setBusy(true);
    haptic.tap();
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.85, exif: false });
      if (!pic?.uri) throw new Error("no picture");
      onCaptured({
        uri: pic.uri,
        name: `${purpose}-${Date.now()}.jpg`,
        mime: "image/jpeg",
        width: pic.width,
        height: pic.height,
        origin: "camera",
        crop: selfie ? undefined : cropFor(f, vw, vh, pic.width, pic.height),
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const guide = selfie ? t("kyc.camera.guide.selfie") : purpose === "poa" || purpose === "doc" ? t("kyc.camera.guide.poa") : passport ? t("kyc.camera.guide.passport") : t("kyc.camera.guide.card");
  const granted = !!perm?.granted;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }} testID="kyc-camera">
        {granted && !failed ? (
          <>
            <CameraView
              ref={cam}
              style={StyleSheet.absoluteFill}
              facing={selfie ? "front" : "back"}
              mirror={false}
              enableTorch={torch && !selfie}
              animateShutter
              onCameraReady={() => setReady(true)}
              onMountError={() => setFailed(true)}
            />
            <Svg width={vw} height={vh} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <Mask id="kyc-guide">
                  <Rect x={0} y={0} width={vw} height={vh} fill="white" />
                  {selfie ? <Ellipse cx={f.x + f.w / 2} cy={f.y + f.h / 2} rx={f.w / 2} ry={f.h / 2} fill="black" /> : <Rect x={f.x} y={f.y} width={f.w} height={f.h} rx={16} ry={16} fill="black" />}
                </Mask>
              </Defs>
              <Rect x={0} y={0} width={vw} height={vh} fill="rgba(0,0,0,0.58)" mask="url(#kyc-guide)" />
              {selfie ? (
                <Ellipse cx={f.x + f.w / 2} cy={f.y + f.h / 2} rx={f.w / 2} ry={f.h / 2} fill="none" stroke={colors.cream} strokeWidth={3} />
              ) : (
                <Rect x={f.x} y={f.y} width={f.w} height={f.h} rx={16} ry={16} fill="none" stroke={colors.cream} strokeWidth={3} />
              )}
              {!selfie && passport ? <Rect x={f.x + f.w * 0.04} y={f.y + f.h * 0.78} width={f.w * 0.92} height={f.h * 0.16} fill="none" stroke="rgba(245,239,227,0.55)" strokeDasharray="6 6" strokeWidth={1.5} /> : null}
            </Svg>
            <View style={{ position: "absolute", top: f.y + f.h + space[5], start: space[6], end: space[6], alignItems: "center" }} pointerEvents="none">
              <Text variant="callout" weight="600" align="center" color={colors.cream} accessibilityLiveRegion="polite">
                {guide}
              </Text>
            </View>
          </>
        ) : (
          <PermissionState
            loading={!perm}
            failed={failed}
            canAsk={perm?.canAskAgain !== false}
            onAllow={() => void requestPerm()}
            onFallback={() => {
              onClose();
              onFallback();
            }}
          />
        )}

        {/* top bar */}
        <View style={{ position: "absolute", top: 0, start: 0, end: 0, paddingTop: insets.top + space[2], paddingHorizontal: space[4], flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <IconButton tone="surface" accessibilityLabel={t("kyc.camera.closeAria")} icon={<X size={22} color={colors.text} />} onPress={onClose} />
          <Display size="xs" color={colors.cream} numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {title}
          </Display>
          {granted && !failed && !selfie ? (
            <IconButton tone="surface" accessibilityLabel={torch ? t("mobileProfile.camera.torchOff") : t("mobileProfile.camera.torchOn")} icon={torch ? <FlashlightOff size={20} color={colors.gold} /> : <Flashlight size={20} color={colors.text} />} onPress={() => setTorch((v) => !v)} />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* shutter */}
        {granted && !failed ? (
          <View style={{ position: "absolute", bottom: Math.max(insets.bottom, space[4]) + space[5], start: 0, end: 0, alignItems: "center" }}>
            <PressableScale
              onPress={() => void capture()}
              disabled={!ready || busy}
              accessibilityLabel={t("kyc.camera.captureAria")}
              testID="kyc-shutter"
              scaleTo={0.92}
              style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.cream, alignItems: "center", justifyContent: "center" }}
            >
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: busy ? colors.text3 : colors.cream }} />
            </PressableScale>
            {!ready ? (
              <Text variant="caption" color={colors.text2} style={{ marginTop: space[2] }}>
                {t("kyc.camera.starting")}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function PermissionState({ loading, failed, canAsk, onAllow, onFallback }: { loading: boolean; failed: boolean; canAsk: boolean; onAllow: () => void; onFallback: () => void }) {
  const t = useT();
  if (loading) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: space[6], gap: space[4] }}>
      <View style={{ width: 64, height: 64, borderRadius: radius.card, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
        <CameraIcon size={28} color={colors.cream} />
      </View>
      <Display size="lg">{t("mobileProfile.camera.permissionTitle")}</Display>
      <Text tone="secondary">{failed ? t("mobileProfile.camera.unavailable") : canAsk ? t("mobileProfile.camera.permissionBody") : t("mobileProfile.camera.deniedBody")}</Text>
      <View style={{ gap: space[2], marginTop: space[2] }}>
        {!failed ? canAsk ? <Button label={t("mobileProfile.camera.allow")} onPress={onAllow} /> : Platform.OS !== "web" ? <Button label={t("mobileProfile.camera.openSettings")} onPress={() => void Linking.openSettings()} /> : null : null}
        <Button label={t("mobileProfile.slot.choosePhoto")} variant="secondary" onPress={onFallback} />
      </View>
    </View>
  );
}
