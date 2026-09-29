// The deposit request the client is paying right now, remembered per user on this phone, so leaving for a wallet
// app (or the OS closing Kalks meanwhile) comes back to the same address, amount and countdown.
import { kv } from "@/lib/kv";
import { onSignOut, sessionStore } from "@/session";

export const INTENT_RE = /^dep_[0-9a-f]{24}$/;

const keyOf = () => {
  const id = sessionStore.get().user?.id;
  return id ? `kalks.wallet.intent.${id}` : null;
};

export function getCurrentIntent(): string | null {
  const k = keyOf();
  const v = k ? kv.get(k) : null;
  return v && INTENT_RE.test(v) ? v : null;
}

export function setCurrentIntent(id: string | null) {
  const k = keyOf();
  if (!k) return;
  if (id && INTENT_RE.test(id)) kv.set(k, id);
  else kv.remove(k);
}

onSignOut(() => {
  const k = keyOf();
  if (k) kv.remove(k);
});
