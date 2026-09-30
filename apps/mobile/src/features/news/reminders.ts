// Calendar reminders on the phone: which events have one, toggled optimistically (a reminder is not a money action)
// and rolled back when the server refuses. Each bell subscribes to its own event id, so a toggle re-renders that bell
// only, never the calendar list. The server (services/news) sends the notification; its answer is the truth.
// Haptics come from the control that was pressed (the bell and the lead-time pills give the selection tick, buttons
// their tap); a refusal only flips back with the server's reason (no error buzz: haptics are for selection, refresh,
// fills and closes).
import { i18n } from "@/i18n";
import { getQueryData, setQueryData } from "@/lib/query";
import { createStore, useStore } from "@/lib/store";
import { onSignOut, sessionStore } from "@/session";
import { toast } from "@/ui";
import { addReminder, deleteReminder, keys, type CalEvent, type MyCalendar } from "./api";

type State = { on: ReadonlySet<number>; minutes: Readonly<Record<string, number>>; busy: ReadonlySet<number> };
const EMPTY: State = { on: new Set(), minutes: {}, busy: new Set() };
export const remindersStore = createStore<State>(EMPTY);
onSignOut(() => remindersStore.set(EMPTY));

/** The server's list (after a fetch); events with a request in flight keep their optimistic state. */
export function syncReminders(my: MyCalendar | undefined) {
  if (!my) return;
  remindersStore.set((s) => {
    const on = new Set(my.reminders);
    for (const id of s.busy) {
      if (s.on.has(id)) on.add(id);
      else on.delete(id);
    }
    const same = on.size === s.on.size && [...on].every((id) => s.on.has(id));
    const minutes = { ...(my.minutes ?? {}) };
    const sameMin = JSON.stringify(minutes) === JSON.stringify(s.minutes);
    return same && sameMin ? s : { ...s, on: same ? s.on : on, minutes: sameMin ? s.minutes : minutes };
  });
}

export const useReminded = (id: number) => useStore(remindersStore, (s) => s.on.has(id));
export const useReminderMinutes = (id: number) => useStore(remindersStore, (s) => s.minutes[id] ?? null);
export const useReminderBusy = (id: number) => useStore(remindersStore, (s) => s.busy.has(id));
export const useReminderCount = () => useStore(remindersStore, (s) => s.on.size);

function patch(id: number, on: boolean, minutes: number | null, busy: boolean) {
  remindersStore.set((s) => {
    const nextOn = new Set(s.on);
    if (on) nextOn.add(id);
    else nextOn.delete(id);
    const nextBusy = new Set(s.busy);
    if (busy) nextBusy.add(id);
    else nextBusy.delete(id);
    const nextMin = { ...s.minutes };
    if (on && minutes) nextMin[id] = minutes;
    if (!on) delete nextMin[id];
    return { on: nextOn, minutes: nextMin, busy: nextBusy };
  });
}

/** Keep the cached `me/calendar` answer (persisted per user) in step with a confirmed change. */
function commit(id: number, on: boolean, minutes: number | null) {
  const prev = getQueryData<MyCalendar>(keys.my);
  if (!prev) return;
  const reminders = on ? [...new Set([...prev.reminders, id])] : prev.reminders.filter((x) => x !== id);
  const m = { ...(prev.minutes ?? {}) };
  if (on && minutes) m[id] = minutes;
  if (!on) delete m[id];
  setQueryData<MyCalendar>(keys.my, { ...prev, reminders, minutes: m }, true);
}

const viewOnly = () => !!sessionStore.get().viewer;

/**
 * Sets (or moves) a reminder `minutes` before the event, or removes it (`minutes` null). The bell flips at once; a
 * refusal flips it back with the server's reason. Returns whether the server accepted.
 */
export async function setReminder(e: CalEvent, minutes: number | null): Promise<boolean> {
  const t = i18n.t;
  if (viewOnly()) {
    toast.show({ title: t("mobile.viewOnly"), body: t("mobileNews.cal.viewOnlyRemind"), tone: "error" });
    return false;
  }
  const s = remindersStore.get();
  if (s.busy.has(e.id)) return false;
  const wasOn = s.on.has(e.id);
  const wasMin = s.minutes[e.id] ?? null;
  const on = minutes !== null;
  patch(e.id, on, minutes, true);
  const r = on ? await addReminder(e.id, minutes) : await deleteReminder(e.id);
  if (!r.ok) {
    patch(e.id, wasOn, wasMin, false);
    toast.show({ title: t("news.cal.reminder.error"), body: r.error.message, tone: "error" });
    return false;
  }
  patch(e.id, on, minutes, false);
  commit(e.id, on, minutes);
  if (!on) toast.show({ title: t("news.cal.reminder.removed"), body: `${e.currency} ${e.title}` }, 1800);
  else if (wasOn) toast.show({ title: t("mobileNews.cal.reminderChanged", { minutes }), body: `${e.currency} ${e.title}`, tone: "success" }, 1800);
  else toast.show({ title: t("news.cal.reminder.set"), body: t("mobileNews.cal.reminderSetDesc", { minutes, currency: e.currency, title: e.title }), tone: "success" }, 2200);
  return true;
}

/** The row bell: on with the default lead time (15 minutes, the web's), or off. */
export function toggleReminder(e: CalEvent) {
  const on = remindersStore.get().on.has(e.id);
  return setReminder(e, on ? null : 15);
}
