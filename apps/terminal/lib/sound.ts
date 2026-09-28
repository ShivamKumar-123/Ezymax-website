/** Tiny WebAudio chimes, no audio files. */
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, gain = 0.06) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

export function beep(kind: "fill" | "close" | "alert" | "error" = "fill") {
  try {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "fill") {
      tone(880, 0, 0.09);
      tone(1320, 0.08, 0.14);
    } else if (kind === "close") {
      tone(1320, 0, 0.09);
      tone(990, 0.08, 0.14);
    } else if (kind === "alert") {
      tone(1046, 0, 0.12);
      tone(1046, 0.18, 0.12);
      tone(1568, 0.36, 0.2);
    } else tone(220, 0, 0.25, 0.08);
  } catch {
    /* audio unavailable */
  }
}
