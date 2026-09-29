// Signed-out entry: onboarding on the first launch, sign-in afterwards.
import { Redirect } from "expo-router";
import { kv } from "@/lib/kv";
import { PREF } from "@/lib/prefs";

export default function AuthIndex() {
  return <Redirect href={kv.get(PREF.onboarded) ? "/sign-in" : "/onboarding"} />;
}
